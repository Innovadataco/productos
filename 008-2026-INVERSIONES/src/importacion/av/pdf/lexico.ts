/**
 * Léxico y valores de PDF (ISO 32000-1 §7.2-7.3), lo justo para el PDF de jsPDF del portal de A&V.
 * Escrito a mano y lineal (sin expresiones regulares sobre el archivo): cada byte se mira una vez.
 * Topes: largo de cadena y de nombre, elementos por arreglo o diccionario y profundidad de anidamiento.
 * Ante cualquier cosa rara lanza ErrorPdf con un código, nunca con el contenido.
 */
import { ErrorPdf } from "./errores";

export const MAX_CADENA = 65_536;
export const MAX_PROFUNDIDAD = 32;
const MAX_NOMBRE = 127;
const MAX_PALABRA = 64;
const MAX_ELEMENTOS = 100_000;

export type Delimitador = "[" | "]" | "<<" | ">>" | "{" | "}";

export type Token =
  | { readonly t: "num"; readonly v: number }
  | { readonly t: "nombre"; readonly v: string }
  | { readonly t: "cadena"; readonly v: Uint8Array }
  | { readonly t: "palabra"; readonly v: string }
  | { readonly t: "delim"; readonly v: Delimitador };

export interface PdfNombre { readonly tipo: "nombre"; readonly v: string }
export interface PdfCadena { readonly tipo: "cadena"; readonly v: Uint8Array }
export interface PdfArreglo { readonly tipo: "arreglo"; readonly v: readonly PdfValor[] }
export interface PdfDic { readonly tipo: "dic"; readonly v: ReadonlyMap<string, PdfValor> }
export interface PdfRef { readonly tipo: "ref"; readonly num: number; readonly gen: number }
export type PdfValor = number | boolean | null | PdfNombre | PdfCadena | PdfArreglo | PdfDic | PdfRef;

const esBlanco = (b: number) => b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;
const DELIMITADORES = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const esRegular = (b: number) => !esBlanco(b) && !DELIMITADORES.has(b);
const NUMERO = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

function valorHex(b: number): number {
  if (b >= 0x30 && b <= 0x39) return b - 0x30;
  if (b >= 0x41 && b <= 0x46) return b - 0x37;
  if (b >= 0x61 && b <= 0x66) return b - 0x57;
  return -1;
}

const ESCAPES: Readonly<Record<number, number>> = { 0x6e: 0x0a, 0x72: 0x0d, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c };

export class Lexico {
  private p: number;

  constructor(private readonly b: Uint8Array, inicio = 0, private readonly fin = b.length) {
    this.p = inicio;
  }

  get posicion(): number {
    return this.p;
  }

  set posicion(valor: number) {
    this.p = valor;
  }

  /** El siguiente token, o null al final. */
  siguiente(): Token | null {
    this.saltarBlancos();
    if (this.p >= this.fin) return null;
    const c = this.b[this.p]!;
    if (c === 0x28) return { t: "cadena", v: this.cadenaLiteral() };
    if (c === 0x2f) return { t: "nombre", v: this.nombre() };
    if (c === 0x3c && this.b[this.p + 1] === 0x3c) return this.delim("<<", 2);
    if (c === 0x3e && this.b[this.p + 1] === 0x3e) return this.delim(">>", 2);
    if (c === 0x3c) return { t: "cadena", v: this.cadenaHex() };
    if (c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) return this.delim(String.fromCharCode(c) as Delimitador, 1);
    if (c === 0x29 || c === 0x3e) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    return this.palabraONumero();
  }

  private delim(v: Delimitador, largo: number): Token {
    this.p += largo;
    return { t: "delim", v };
  }

  private saltarBlancos(): void {
    while (this.p < this.fin) {
      const c = this.b[this.p]!;
      if (esBlanco(c)) this.p += 1;
      else if (c === 0x25) while (this.p < this.fin && this.b[this.p] !== 0x0a && this.b[this.p] !== 0x0d) this.p += 1;
      else return;
    }
  }

  private palabraONumero(): Token {
    const inicio = this.p;
    while (this.p < this.fin && esRegular(this.b[this.p]!)) this.p += 1;
    if (this.p - inicio > MAX_PALABRA) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    const texto = String.fromCharCode(...this.b.subarray(inicio, this.p));
    return NUMERO.test(texto) ? { t: "num", v: Number(texto) } : { t: "palabra", v: texto };
  }

  private nombre(): string {
    this.p += 1;
    let texto = "";
    while (this.p < this.fin && esRegular(this.b[this.p]!)) {
      const c = this.b[this.p]!;
      if (c === 0x23) {
        const alto = valorHex(this.b[this.p + 1] ?? -1);
        const bajo = valorHex(this.b[this.p + 2] ?? -1);
        if (alto < 0 || bajo < 0) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
        texto += String.fromCharCode(alto * 16 + bajo);
        this.p += 3;
      } else {
        texto += String.fromCharCode(c);
        this.p += 1;
      }
      if (texto.length > MAX_NOMBRE) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    }
    return texto;
  }

  private cadenaHex(): Uint8Array {
    this.p += 1;
    const salida: number[] = [];
    let alto = -1;
    for (; this.p < this.fin; this.p += 1) {
      const c = this.b[this.p]!;
      if (c === 0x3e) {
        this.p += 1;
        if (alto >= 0) salida.push(alto * 16);
        return Uint8Array.from(salida);
      }
      if (esBlanco(c)) continue;
      const v = valorHex(c);
      if (v < 0) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
      if (alto < 0) alto = v;
      else {
        salida.push(alto * 16 + v);
        alto = -1;
      }
      if (salida.length > MAX_CADENA) throw new ErrorPdf("PDF_CADENA_LARGA");
    }
    throw new ErrorPdf("PDF_CADENA_ABIERTA");
  }

  private cadenaLiteral(): Uint8Array {
    this.p += 1;
    const salida: number[] = [];
    let nivel = 1;
    while (this.p < this.fin) {
      const c = this.b[this.p]!;
      this.p += 1;
      if (c === 0x28) nivel += 1;
      if (c === 0x29) nivel -= 1;
      if (nivel === 0) return Uint8Array.from(salida);
      if (c === 0x5c) this.escape(salida);
      else if (c === 0x0d) {
        if (this.b[this.p] === 0x0a) this.p += 1;
        salida.push(0x0a);
      } else salida.push(c);
      if (salida.length > MAX_CADENA) throw new ErrorPdf("PDF_CADENA_LARGA");
    }
    throw new ErrorPdf("PDF_CADENA_ABIERTA");
  }

  /** Lo que sigue a una barra invertida dentro de una cadena literal (la barra ya se consumió). */
  private escape(salida: number[]): void {
    if (this.p >= this.fin) throw new ErrorPdf("PDF_CADENA_ABIERTA");
    const c = this.b[this.p]!;
    this.p += 1;
    if (c >= 0x30 && c <= 0x37) {
      let v = c - 0x30;
      for (let k = 0; k < 2 && this.p < this.fin && this.b[this.p]! >= 0x30 && this.b[this.p]! <= 0x37; k += 1) v = v * 8 + (this.b[this.p++]! - 0x30);
      salida.push(v & 0xff);
    } else if (c === 0x0d) {
      if (this.b[this.p] === 0x0a) this.p += 1;
    } else if (c !== 0x0a) salida.push(ESCAPES[c] ?? c);
  }
}

const esEnteroNoNegativo = (t: Token | null): t is { t: "num"; v: number } => t?.t === "num" && Number.isInteger(t.v) && t.v >= 0;

/** «N G R» → referencia; si no, el número solo (el léxico vuelve a donde estaba). */
function numeroOReferencia(lex: Lexico, n: number): PdfValor {
  const vuelta = lex.posicion;
  const gen = lex.siguiente();
  if (Number.isInteger(n) && n >= 0 && esEnteroNoNegativo(gen)) {
    const r = lex.siguiente();
    if (r?.t === "palabra" && r.v === "R") return { tipo: "ref", num: n, gen: gen.v };
  }
  lex.posicion = vuelta;
  return n;
}

function arreglo(lex: Lexico, profundidad: number): PdfArreglo {
  const v: PdfValor[] = [];
  for (let t = lex.siguiente(); ; t = lex.siguiente()) {
    if (t === null) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    if (t.t === "delim" && t.v === "]") return { tipo: "arreglo", v };
    v.push(leerValor(lex, t, profundidad + 1));
    if (v.length > MAX_ELEMENTOS) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
  }
}

function diccionario(lex: Lexico, profundidad: number): PdfDic {
  const v = new Map<string, PdfValor>();
  for (let t = lex.siguiente(); ; t = lex.siguiente()) {
    if (t === null) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    if (t.t === "delim" && t.v === ">>") return { tipo: "dic", v };
    if (t.t !== "nombre") throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    v.set(t.v, leerValor(lex, null, profundidad + 1));
    if (v.size > MAX_ELEMENTOS) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
  }
}

/** Lee un valor (con su primer token ya leído, si se da). */
export function leerValor(lex: Lexico, primero: Token | null = null, profundidad = 0): PdfValor {
  if (profundidad > MAX_PROFUNDIDAD) throw new ErrorPdf("PDF_PROFUNDIDAD_EXCESIVA");
  const t = primero ?? lex.siguiente();
  if (t === null) throw new ErrorPdf("PDF_OBJETO_INVALIDO");
  switch (t.t) {
    case "num":
      return numeroOReferencia(lex, t.v);
    case "nombre":
      return { tipo: "nombre", v: t.v };
    case "cadena":
      return { tipo: "cadena", v: t.v };
    case "palabra":
      if (t.v === "true" || t.v === "false") return t.v === "true";
      if (t.v === "null") return null;
      throw new ErrorPdf("PDF_OBJETO_INVALIDO");
    case "delim":
      if (t.v === "[") return arreglo(lex, profundidad);
      if (t.v === "<<") return diccionario(lex, profundidad);
      throw new ErrorPdf("PDF_OBJETO_INVALIDO");
  }
}
