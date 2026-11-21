/**
 * Intérprete del contenido de una página (ISO 32000-1 §8.4, §9.3-9.4): saca cada texto mostrado con su
 * posición en la página. Solo texto horizontal, visible (Tr 0) y dentro de la página, con fuentes estándar
 * WinAnsi. Un operador desconocido o mal formado falla cerrado: lo extraído tiene que ser lo que se ve.
 */
import type { DocumentoPdf, FuenteEstandar, PaginaPdf } from "./documento";
import { ErrorPdf } from "./errores";
import { Lexico, leerValor, type PdfValor } from "./lexico";
import { decodificarWinAnsi } from "./winansi";

export interface CeldaPdf {
  readonly pagina: number;
  readonly x: number;
  readonly y: number;
  readonly texto: string;
}

export const MAX_TEXTO_CELDA = 1024;
export const MAX_CELDAS = 20_000;
const MAX_OPERADORES = 500_000;
const MAX_OPERANDOS = 64;
const MAX_PILA_GRAFICA = 64;
/** Un ajuste de TJ de -250 milésimas o menos separa palabras. */
const AJUSTE_ESPACIO = -250;
const TAMANO_MINIMO = 1;
const EPSILON = 1e-6;

type Matriz = readonly [number, number, number, number, number, number];
const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

/** m1 × m2 con la convención de vector fila de PDF. */
function por(m1: Matriz, m2: Matriz): Matriz {
  const [a, b, c, d, e, f] = m1;
  const [A, B, C, D, E, F] = m2;
  return [a * A + b * C, a * B + b * D, c * A + d * C, c * B + d * D, e * A + f * C + E, e * B + f * D + F];
}

const traslacion = (tx: number, ty: number): Matriz => [1, 0, 0, 1, tx, ty];
const redondear = (v: number) => Math.round(v * 100) / 100;

/** Operadores que no cambian qué texto se ve ni dónde (color, trazos, marcas, espaciado entre letras). */
const IGNORADOS = new Set([
  "w", "J", "j", "M", "d", "ri", "i", "gs", "g", "G", "rg", "RG", "k", "K", "cs", "CS", "sc", "scn", "SC", "SCN",
  "m", "l", "c", "v", "y", "h", "re", "S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n", "W", "W*", "sh",
  "BMC", "BDC", "EMC", "MP", "DP", "BX", "EX", "Do", "Tc", "Tw", "Tz", "Ts",
]);

/** Lo que guarda q y restaura Q (§8.4.2): la matriz y los parámetros de texto que viven en el estado gráfico. */
interface EstadoGrafico {
  readonly ctm: Matriz;
  readonly fuente: FuenteEstandar | null;
  readonly tamano: number;
  readonly tl: number;
  readonly tr: number;
}

class Interprete {
  private ctm: Matriz = IDENTIDAD;
  private readonly pila: EstadoGrafico[] = [];
  private enTexto = false;
  private tm: Matriz = IDENTIDAD;
  private tlm: Matriz = IDENTIDAD;
  private tl = 0;
  private fuente: FuenteEstandar | null = null;
  private tamano = 0;
  private tr = 0;
  private continua = false;
  readonly celdas: CeldaPdf[] = [];

  constructor(private readonly pagina: PaginaPdf) {}

  ejecutar(op: string, a: readonly PdfValor[]): void {
    if (op === "q" || op === "Q" || op === "cm") return this.grafico(op, a);
    if (op === "BT" || op === "ET") return this.bloque(op, a);
    if (op === "Tf" || op === "TL" || op === "Tr") return this.estadoTexto(op, a);
    if (op === "Td" || op === "TD" || op === "Tm" || op === "T*") return this.posicion(op, a);
    if (op === "Tj" || op === "TJ" || op === "'" || op === '"') return this.mostrarOperador(op, a);
    if (!IGNORADOS.has(op)) throw new ErrorPdf("PDF_OPERADOR_NO_SOPORTADO");
  }

  terminar(): void {
    if (this.enTexto || this.pila.length > 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  }

  private grafico(op: string, a: readonly PdfValor[]): void {
    if (op === "q") {
      if (a.length !== 0 || this.pila.length >= MAX_PILA_GRAFICA) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      this.pila.push({ ctm: this.ctm, fuente: this.fuente, tamano: this.tamano, tl: this.tl, tr: this.tr });
    } else if (op === "Q") {
      const previo = this.pila.pop();
      if (previo === undefined || a.length !== 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      ({ ctm: this.ctm, fuente: this.fuente, tamano: this.tamano, tl: this.tl, tr: this.tr } = previo);
    } else this.ctm = por(matriz(a), this.ctm);
  }

  private bloque(op: string, a: readonly PdfValor[]): void {
    if (a.length !== 0 || this.enTexto === (op === "BT")) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    this.enTexto = op === "BT";
    this.tm = IDENTIDAD;
    this.tlm = IDENTIDAD;
    this.continua = false;
  }

  private estadoTexto(op: string, a: readonly PdfValor[]): void {
    if (op === "Tf") {
      const [nombre, tamano] = a;
      if (a.length !== 2 || typeof tamano !== "number" || typeof nombre !== "object" || nombre === null || nombre.tipo !== "nombre") throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      const fuente = this.pagina.fuentes.get(nombre.v);
      if (!fuente) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
      this.fuente = fuente;
      this.tamano = tamano;
    } else if (op === "TL") this.tl = numeros(a, 1)[0]!;
    else this.tr = numeros(a, 1)[0]!;
  }

  private posicion(op: string, a: readonly PdfValor[]): void {
    this.exigirTexto();
    if (op === "Tm") this.tlm = matriz(a);
    else if (op === "T*") {
      if (a.length !== 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      this.tlm = por(traslacion(0, -this.tl), this.tlm);
    } else {
      const [tx, ty] = numeros(a, 2);
      if (op === "TD") this.tl = -ty!;
      this.tlm = por(traslacion(tx!, ty!), this.tlm);
    }
    this.tm = this.tlm;
    this.continua = false;
  }

  private mostrarOperador(op: string, a: readonly PdfValor[]): void {
    this.exigirTexto();
    if (op === "TJ") return this.mostrar(textoDeTJ(a));
    const cadena = a[a.length - 1];
    const esperados = op === '"' ? 3 : 1;
    if (a.length !== esperados || typeof cadena !== "object" || cadena === null || cadena.tipo !== "cadena") throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    if (op === '"') numeros(a.slice(0, 2), 2);
    if (op !== "Tj") this.posicion("T*", []);
    this.mostrar([cadena.v]);
  }

  private exigirTexto(): void {
    if (!this.enTexto) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  }

  /** Piezas: bytes WinAnsi o un espacio que viene de un ajuste de TJ. */
  private mostrar(piezas: readonly (Uint8Array | " ")[]): void {
    if (!this.fuente?.conTexto) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
    const m = por(this.tm, this.ctm);
    const visible = this.tr === 0 && Math.abs(m[1]) < EPSILON && Math.abs(m[2]) < EPSILON && m[0] > 0 && m[3] * this.tamano >= TAMANO_MINIMO;
    const [x, y] = [redondear(m[4]), redondear(m[5])];
    const dentro = x >= 0 && y >= 0 && x <= this.pagina.ancho && y <= this.pagina.alto;
    if (!visible || !dentro) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
    const texto = piezas.map((p) => (p === " " ? " " : decodificarWinAnsi(p))).join("");
    const previa = this.continua ? this.celdas.pop() : undefined;
    const celda = previa ? { ...previa, texto: previa.texto + texto } : { pagina: this.pagina.numero, x, y, texto };
    if (celda.texto.length > MAX_TEXTO_CELDA) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
    this.celdas.push(celda);
    this.continua = true;
  }
}

function numeros(a: readonly PdfValor[], cuantos: number): number[] {
  if (a.length !== cuantos || !a.every((v): v is number => typeof v === "number" && Number.isFinite(v))) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  return a as number[];
}

const matriz = (a: readonly PdfValor[]): Matriz => numeros(a, 6) as unknown as Matriz;

function textoDeTJ(a: readonly PdfValor[]): (Uint8Array | " ")[] {
  const [arreglo] = a;
  if (a.length !== 1 || typeof arreglo !== "object" || arreglo === null || arreglo.tipo !== "arreglo") throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  return arreglo.v.flatMap((v): (Uint8Array | " ")[] => {
    if (typeof v === "number") return v <= AJUSTE_ESPACIO ? [" "] : [];
    if (typeof v === "object" && v !== null && v.tipo === "cadena") return [v.v];
    throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  });
}

function interpretarPagina(pagina: PaginaPdf): CeldaPdf[] {
  const lex = new Lexico(pagina.contenido);
  const interprete = new Interprete(pagina);
  let operandos: PdfValor[] = [];
  for (let t = lex.siguiente(), cuenta = 0; t !== null; t = lex.siguiente(), cuenta += 1) {
    if (cuenta > MAX_OPERADORES) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
    if (t.t === "palabra" && t.v !== "true" && t.v !== "false" && t.v !== "null") {
      interprete.ejecutar(t.v, operandos);
      operandos = [];
    } else {
      operandos.push(leerValor(lex, t));
      if (operandos.length > MAX_OPERANDOS) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    }
  }
  if (operandos.length > 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  interprete.terminar();
  return interprete.celdas;
}

/** Todas las celdas del documento, página por página, en el orden en que se pintaron. */
export function extraerCeldas(doc: DocumentoPdf): CeldaPdf[] {
  const celdas: CeldaPdf[] = [];
  for (const pagina of doc.paginas) {
    celdas.push(...interpretarPagina(pagina));
    if (celdas.length > MAX_CELDAS) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
  }
  return celdas;
}
