/**
 * Tabla xref clásica, trailer, objetos y streams (ISO 32000-1 §7.3.8, §7.5). Solo lo que escribe jsPDF:
 * una xref clásica sin /Prev; no hay xref en stream ni objetos comprimidos (ObjStm). Cada objeto se lee
 * desde su offset y debe declarar el número que la xref dice. Los streams se cortan por /Length
 * (nunca buscando «endstream», que puede aparecer en datos binarios) y solo se infla FlateDecode, con tope.
 */
import { inflateSync } from "node:zlib";
import { ErrorPdf } from "./errores";
import { Lexico, leerValor, type PdfDic, type PdfRef, type PdfValor } from "./lexico";

export const MAX_OBJETOS = 10_000;
export const MAX_INFLADO_POR_STREAM = 8 * 1024 * 1024;
/** Presupuesto de bytes inflados de todo el archivo: se descuenta mientras se infla, no al final. */
export const MAX_INFLADO_TOTAL = 16 * 1024 * 1024;
const COLA_STARTXREF = 2048;
const MAX_SALTOS_REF = 8;

interface Objeto {
  readonly valor: PdfValor;
  /** Offset del primer byte de datos, si el objeto es un stream. */
  readonly inicioStream: number | null;
}

export interface Referencias {
  readonly trailer: PdfDic;
  /** Sigue referencias (con tope de saltos) hasta un valor directo. */
  resolver(valor: PdfValor | undefined): PdfValor | undefined;
  /** El diccionario de un stream y sus datos ya decodificados. */
  stream(valor: PdfValor | undefined): { readonly dic: PdfDic; readonly datos: Uint8Array };
  /** Solo el diccionario de un stream, sin leer ni decodificar sus datos (imágenes). */
  dicDeStream(valor: PdfValor | undefined): PdfDic;
}

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const STARTXREF = ascii("startxref");
const ENDSTREAM = ascii("endstream");

function buscarDesdeElFinal(b: Uint8Array, aguja: Uint8Array, desde: number): number {
  for (let i = b.length - aguja.length; i >= desde; i -= 1) {
    let k = 0;
    while (k < aguja.length && b[i + k] === aguja[k]) k += 1;
    if (k === aguja.length) return i;
  }
  return -1;
}

const esDic = (v: PdfValor | undefined): v is PdfDic => typeof v === "object" && v !== null && v.tipo === "dic";
const entero = (v: PdfValor | undefined | null): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

function palabra(lex: Lexico, esperada: string, codigo: "PDF_OBJETO_INVALIDO" | "PDF_FORMATO_NO_SOPORTADO" | "PDF_XREF_INVALIDA"): void {
  const t = lex.siguiente();
  if (t?.t !== "palabra" || t.v !== esperada) throw new ErrorPdf(codigo);
}

function numero(lex: Lexico, codigo: "PDF_XREF_INVALIDA" | "PDF_OBJETO_INVALIDO"): number {
  const t = lex.siguiente();
  const v = t?.t === "num" ? entero(t.v) : null;
  if (v === null) throw new ErrorPdf(codigo);
  return v;
}

/** Lee «xref … trailer <<…>>» desde el offset de startxref. Devuelve offsets por número de objeto. */
function leerXref(b: Uint8Array): { offsets: Map<number, { offset: number; gen: number }>; trailer: PdfDic } {
  const pos = buscarDesdeElFinal(b, STARTXREF, Math.max(0, b.length - COLA_STARTXREF));
  if (pos < 0) throw new ErrorPdf("PDF_FORMATO_NO_SOPORTADO");
  const cola = new Lexico(b, pos + STARTXREF.length);
  const inicio = numero(cola, "PDF_XREF_INVALIDA");
  if (inicio >= b.length) throw new ErrorPdf("PDF_XREF_INVALIDA");
  const lex = new Lexico(b, inicio);
  palabra(lex, "xref", "PDF_FORMATO_NO_SOPORTADO");
  const offsets = new Map<number, { offset: number; gen: number }>();
  for (let t = lex.siguiente(); ; t = lex.siguiente()) {
    if (t?.t === "palabra" && t.v === "trailer") break;
    const primero = t?.t === "num" ? entero(t.v) : null;
    const cuantos = numero(lex, "PDF_XREF_INVALIDA");
    if (primero === null || offsets.size + cuantos > MAX_OBJETOS) throw new ErrorPdf(primero === null ? "PDF_XREF_INVALIDA" : "PDF_DEMASIADOS_OBJETOS");
    for (let i = 0; i < cuantos; i += 1) {
      const offset = numero(lex, "PDF_XREF_INVALIDA");
      const gen = numero(lex, "PDF_XREF_INVALIDA");
      const tipo = lex.siguiente();
      if (tipo?.t !== "palabra" || (tipo.v !== "n" && tipo.v !== "f")) throw new ErrorPdf("PDF_XREF_INVALIDA");
      if (tipo.v === "n") offsets.set(primero + i, { offset, gen });
    }
  }
  const trailer = leerValor(lex);
  if (!esDic(trailer)) throw new ErrorPdf("PDF_XREF_INVALIDA");
  return { offsets, trailer };
}

/** Salto de línea después de «stream»: CRLF o LF (§7.3.8.1). */
function inicioDeDatos(b: Uint8Array, p: number): number {
  if (b[p] === 0x0d && b[p + 1] === 0x0a) return p + 2;
  if (b[p] === 0x0a) return p + 1;
  throw new ErrorPdf("PDF_STREAM_INVALIDO");
}

function terminaEnEndstream(b: Uint8Array, fin: number): boolean {
  let p = fin;
  if (b[p] === 0x0d) p += 1;
  if (b[p] === 0x0a) p += 1;
  return ENDSTREAM.every((c, k) => b[p + k] === c);
}

/** Infla con tope: lo que queda del presupuesto total, y nunca más de MAX_INFLADO_POR_STREAM. Sin copiar. */
function inflar(datos: Uint8Array, restante: number): Uint8Array {
  if (restante <= 0) throw new ErrorPdf("PDF_INFLADO_EXCESIVO");
  try {
    const salida = inflateSync(datos, { maxOutputLength: Math.min(MAX_INFLADO_POR_STREAM, restante) });
    return new Uint8Array(salida.buffer, salida.byteOffset, salida.byteLength);
  } catch (e) {
    const codigo = (e as { code?: unknown } | null)?.code;
    throw new ErrorPdf(codigo === "ERR_BUFFER_TOO_LARGE" ? "PDF_INFLADO_EXCESIVO" : "PDF_STREAM_INVALIDO");
  }
}

function filtroFlate(dic: PdfDic): boolean {
  const filtro = dic.v.get("Filter");
  if (filtro === undefined) return false;
  if (dic.v.has("DecodeParms")) throw new ErrorPdf("PDF_FILTRO_NO_SOPORTADO");
  const nombres = typeof filtro === "object" && filtro !== null && filtro.tipo === "arreglo" ? filtro.v : [filtro];
  const flate = nombres.length === 1 && typeof nombres[0] === "object" && nombres[0] !== null && nombres[0].tipo === "nombre" && nombres[0].v === "FlateDecode";
  if (!flate) throw new ErrorPdf("PDF_FILTRO_NO_SOPORTADO");
  return true;
}

/** Lee el objeto que la xref dice que está en su offset; debe declarar ese mismo número y generación. */
function leerObjeto(b: Uint8Array, entrada: { offset: number; gen: number } | undefined, ref: PdfRef): Objeto {
  if (!entrada || entrada.gen !== ref.gen || entrada.offset >= b.length) throw new ErrorPdf("PDF_XREF_INVALIDA");
  const lex = new Lexico(b, entrada.offset);
  if (numero(lex, "PDF_XREF_INVALIDA") !== ref.num || numero(lex, "PDF_XREF_INVALIDA") !== ref.gen) throw new ErrorPdf("PDF_XREF_INVALIDA");
  palabra(lex, "obj", "PDF_XREF_INVALIDA");
  const valor = leerValor(lex);
  const t = lex.siguiente();
  if (t?.t !== "palabra" || (t.v !== "endobj" && t.v !== "stream")) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
  return { valor, inicioStream: t.v === "stream" ? inicioDeDatos(b, lex.posicion) : null };
}

/** Los datos de un stream cortados por /Length (que debe terminar en «endstream»), sin decodificar. */
function datosCrudos(b: Uint8Array, inicio: number, largo: number | null): Uint8Array {
  if (largo === null || inicio + largo > b.length || !terminaEnEndstream(b, inicio + largo)) throw new ErrorPdf("PDF_STREAM_INVALIDO");
  return b.subarray(inicio, inicio + largo);
}

export function abrirReferencias(b: Uint8Array): Referencias {
  const { offsets, trailer } = leerXref(b);
  const cache = new Map<number, Objeto>();
  /** Datos ya decodificados por número de objeto: un stream se infla una sola vez. */
  const decodificados = new Map<number, Uint8Array>();
  let inflados = 0;

  const objeto = (ref: PdfRef): Objeto => {
    const leido = cache.get(ref.num) ?? leerObjeto(b, offsets.get(ref.num), ref);
    cache.set(ref.num, leido);
    return leido;
  };

  const resolver = (valor: PdfValor | undefined): PdfValor | undefined => {
    let v = valor;
    for (let saltos = 0; typeof v === "object" && v !== null && v.tipo === "ref"; saltos += 1) {
      if (saltos >= MAX_SALTOS_REF) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
      v = objeto(v).valor;
    }
    return v;
  };

  const objetoStream = (valor: PdfValor | undefined): Objeto & { readonly valor: PdfDic; readonly inicioStream: number } => {
    if (typeof valor !== "object" || valor === null || valor.tipo !== "ref") throw new ErrorPdf("PDF_STREAM_INVALIDO");
    const o = objeto(valor);
    if (!esDic(o.valor) || o.inicioStream === null) throw new ErrorPdf("PDF_STREAM_INVALIDO");
    return { valor: o.valor, inicioStream: o.inicioStream };
  };

  const stream = (valor: PdfValor | undefined) => {
    const o = objetoStream(valor);
    const num = (valor as PdfRef).num;
    const enCache = decodificados.get(num);
    if (enCache) return { dic: o.valor, datos: enCache };
    const crudos = datosCrudos(b, o.inicioStream, entero(resolver(o.valor.v.get("Length")) ?? null));
    const datos = filtroFlate(o.valor) ? inflar(crudos, MAX_INFLADO_TOTAL - inflados) : crudos;
    if (datos !== crudos) inflados += datos.length;
    decodificados.set(num, datos);
    return { dic: o.valor, datos };
  };

  return { trailer, resolver, stream, dicDeStream: (valor) => objetoStream(valor).valor };
}
