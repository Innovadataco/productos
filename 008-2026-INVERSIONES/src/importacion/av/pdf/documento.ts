/**
 * Documento PDF de la certificación de A&V: páginas en el orden de /Kids, su contenido decodificado,
 * sus fuentes y la fecha de generación (/Info /CreationDate; nada más de /Info se lee).
 * Falla cerrado ante lo que haría que el texto extraído no fuera el que se ve: cifrado, actualizaciones
 * incrementales, fuentes incrustadas o con otra codificación, y XObjects que no son imágenes.
 */
import { ErrorPdf } from "./errores";
import type { PdfDic, PdfValor } from "./lexico";
import { abrirReferencias, type Referencias } from "./referencias";

export { MAX_INFLADO_POR_STREAM } from "./referencias";

export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_PAGINAS = 50;
const MAX_CONTENIDO_TOTAL = 16 * 1024 * 1024;
const MAX_PROFUNDIDAD_PAGINAS = 16;
const CABECERA = "%PDF-1.";

/** Las 14 fuentes estándar (§9.6.2.2): sin incrustar, con métricas conocidas. */
const ESTANDAR = new Set([
  "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
  "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
  "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
  "Symbol", "ZapfDingbats",
]);
const SIMBOLICAS = new Set(["Symbol", "ZapfDingbats"]);
const CLAVES_PROHIBIDAS = ["FontDescriptor", "FontFile", "FontFile2", "FontFile3", "ToUnicode", "DescendantFonts", "CharProcs"];

export interface FuenteEstandar {
  readonly base: string;
  /** false en Symbol y ZapfDingbats: sus códigos no son letras; mostrar texto con ellas se rechaza. */
  readonly conTexto: boolean;
}

export interface PaginaPdf {
  readonly numero: number;
  readonly ancho: number;
  readonly alto: number;
  readonly contenido: Uint8Array;
  readonly fuentes: ReadonlyMap<string, FuenteEstandar>;
}

export interface DocumentoPdf {
  readonly paginas: readonly PaginaPdf[];
  readonly creadoEn: Date | null;
}

const esDic = (v: PdfValor | undefined): v is PdfDic => typeof v === "object" && v !== null && v.tipo === "dic";
const nombre = (v: PdfValor | undefined): string | null => (typeof v === "object" && v !== null && v.tipo === "nombre" ? v.v : null);

interface Heredado {
  readonly recursos: PdfValor | undefined;
  readonly caja: PdfValor | undefined;
}

function leerFuente(refs: Referencias, valor: PdfValor | undefined): FuenteEstandar {
  const dic = refs.resolver(valor);
  if (!esDic(dic) || nombre(dic.v.get("Type")) !== "Font" || nombre(dic.v.get("Subtype")) !== "Type1") throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
  const base = nombre(dic.v.get("BaseFont"));
  if (base === null || !ESTANDAR.has(base) || CLAVES_PROHIBIDAS.some((k) => dic.v.has(k))) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
  const codificacion = dic.v.get("Encoding");
  const simbolica = SIMBOLICAS.has(base);
  const valida = simbolica ? codificacion === undefined : nombre(refs.resolver(codificacion)) === "WinAnsiEncoding";
  if (!valida) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
  return { base, conTexto: !simbolica };
}

function leerFuentes(refs: Referencias, recursos: PdfDic): Map<string, FuenteEstandar> {
  const dic = refs.resolver(recursos.v.get("Font"));
  if (dic === undefined) return new Map();
  if (!esDic(dic)) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
  return new Map([...dic.v].map(([clave, valor]) => [clave, leerFuente(refs, valor)] as const));
}

/** Solo imágenes: un formulario (Form XObject) traería texto propio que no se extraería. */
function validarXObjects(refs: Referencias, recursos: PdfDic): void {
  const dic = refs.resolver(recursos.v.get("XObject"));
  if (dic === undefined) return;
  if (!esDic(dic)) throw new ErrorPdf("PDF_RECURSO_NO_SOPORTADO");
  for (const valor of dic.v.values()) {
    // Solo el diccionario: los datos de una imagen (DCT, Flate con predictor) no se leen ni se decodifican.
    if (nombre(refs.dicDeStream(valor).v.get("Subtype")) !== "Image") throw new ErrorPdf("PDF_RECURSO_NO_SOPORTADO");
  }
}

function leerCaja(refs: Referencias, valor: PdfValor | undefined): { ancho: number; alto: number } {
  const caja = refs.resolver(valor);
  const v = typeof caja === "object" && caja !== null && caja.tipo === "arreglo" ? caja.v.map((x) => refs.resolver(x)) : [];
  if (v.length !== 4 || !v.every((x) => typeof x === "number" && Number.isFinite(x))) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  const [x0, y0, x1, y1] = v as number[];
  if (x0 !== 0 || y0 !== 0 || !(x1! > 0) || !(y1! > 0)) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  return { ancho: x1!, alto: y1! };
}

function leerContenido(refs: Referencias, valor: PdfValor | undefined): Uint8Array {
  if (valor === undefined) return new Uint8Array();
  const partes = typeof valor === "object" && valor !== null && valor.tipo === "arreglo" ? valor.v : [valor];
  const datos = partes.map((p) => refs.stream(p).datos);
  const salida = new Uint8Array(datos.reduce((s, d) => s + d.length + 1, 0));
  let p = 0;
  for (const d of datos) {
    salida.set(d, p);
    salida[p + d.length] = 0x0a;
    p += d.length + 1;
  }
  return salida;
}

function leerPagina(refs: Referencias, dic: PdfDic, heredado: Heredado, numero: number): PaginaPdf {
  const recursos = refs.resolver(dic.v.get("Resources") ?? heredado.recursos);
  if (!esDic(recursos)) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  validarXObjects(refs, recursos);
  const { ancho, alto } = leerCaja(refs, dic.v.get("MediaBox") ?? heredado.caja);
  return { numero, ancho, alto, fuentes: leerFuentes(refs, recursos), contenido: leerContenido(refs, dic.v.get("Contents")) };
}

/** Recorre /Pages → /Kids en orden, con tope de profundidad y de páginas, y sin ciclos ni repetidos. */
function recorrer(refs: Referencias, valor: PdfValor | undefined, heredado: Heredado, profundidad: number, vistos: Set<number>, salida: PaginaPdf[]): void {
  if (profundidad > MAX_PROFUNDIDAD_PAGINAS) throw new ErrorPdf("PDF_PROFUNDIDAD_EXCESIVA");
  if (typeof valor !== "object" || valor === null || valor.tipo !== "ref" || vistos.has(valor.num)) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  vistos.add(valor.num);
  const dic = refs.resolver(valor);
  if (!esDic(dic)) throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  const tipo = nombre(dic.v.get("Type"));
  if (tipo === "Page") {
    if (salida.length >= MAX_PAGINAS) throw new ErrorPdf("PDF_DEMASIADAS_PAGINAS");
    salida.push(leerPagina(refs, dic, heredado, salida.length + 1));
    return;
  }
  const hijos = refs.resolver(dic.v.get("Kids"));
  if (tipo !== "Pages" || typeof hijos !== "object" || hijos === null || hijos.tipo !== "arreglo") throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  const deEste: Heredado = { recursos: dic.v.get("Resources") ?? heredado.recursos, caja: dic.v.get("MediaBox") ?? heredado.caja };
  for (const hijo of hijos.v) recorrer(refs, hijo, deEste, profundidad + 1, vistos, salida);
}

const FECHA_PDF = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}'?\d{2}'?)?/;

/** «D:AAAAMMDDhhmmss±hh'mm'» (§7.9.4) → instante. Lo que no cuadre con un día y hora reales da null. */
export function leerFechaPdf(texto: string): Date | null {
  const m = FECHA_PDF.exec(texto.slice(0, 64));
  if (!m) return null;
  const [anio, mes, dia, hora, minuto, segundo] = [1, 2, 3, 4, 5, 6].map((i, k) => Number(m[i] ?? (k === 1 || k === 2 ? "01" : "00")));
  const local = Date.UTC(anio!, mes! - 1, dia!, hora!, minuto!, segundo!);
  const d = new Date(local);
  // Un día que se sale del mes (30 de febrero) hace que Date cambie de mes: basta mirar año y mes.
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes! - 1 || hora! > 23 || minuto! > 59 || segundo! > 59) return null;
  const zona = m[7];
  if (!zona || zona === "Z") return d;
  const signo = zona.startsWith("-") ? -1 : 1;
  const [zh, zm] = [Number(zona.slice(1, 3)), Number(zona.replace(/'/g, "").slice(3, 5))];
  if (zh > 23 || zm > 59) return null;
  return new Date(local - signo * (zh * 60 + zm) * 60_000);
}

function leerCreadoEn(refs: Referencias): Date | null {
  const info = refs.resolver(refs.trailer.v.get("Info"));
  if (!esDic(info)) return null;
  const fecha = refs.resolver(info.v.get("CreationDate"));
  if (typeof fecha !== "object" || fecha === null || fecha.tipo !== "cadena") return null;
  return leerFechaPdf(String.fromCharCode(...fecha.v.subarray(0, 64)));
}

function empiezaConCabecera(b: Uint8Array): boolean {
  const inicio = String.fromCharCode(...b.subarray(0, Math.min(b.length, 1024)));
  return inicio.indexOf(CABECERA) === 0;
}

export function abrirDocumento(bytes: Uint8Array): DocumentoPdf {
  if (bytes.byteLength > MAX_BYTES) throw new ErrorPdf("PDF_DEMASIADO_GRANDE");
  if (!empiezaConCabecera(bytes)) throw new ErrorPdf("PDF_INVALIDO");
  const refs = abrirReferencias(bytes);
  const t = refs.trailer.v;
  if (t.has("Encrypt")) throw new ErrorPdf("PDF_CIFRADO");
  if (t.has("Prev") || t.has("XRefStm")) throw new ErrorPdf("PDF_FORMATO_NO_SOPORTADO");
  const catalogo = refs.resolver(t.get("Root"));
  if (!esDic(catalogo) || nombre(catalogo.v.get("Type")) !== "Catalog") throw new ErrorPdf("PDF_ESTRUCTURA_INVALIDA");
  const paginas: PaginaPdf[] = [];
  recorrer(refs, catalogo.v.get("Pages"), { recursos: undefined, caja: undefined }, 0, new Set(), paginas);
  if (paginas.reduce((s, p) => s + p.contenido.length, 0) > MAX_CONTENIDO_TOTAL) throw new ErrorPdf("PDF_INFLADO_EXCESIVO");
  return { paginas, creadoEn: leerCreadoEn(refs) };
}
