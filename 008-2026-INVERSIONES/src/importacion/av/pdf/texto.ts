/**
 * Intérprete del contenido de una página (ISO 32000-1 §8.4, §9.3-9.4): saca cada texto mostrado con su
 * posición en la página, y solo acepta el texto que se ve igual que se lee:
 * - horizontal, de tamaño positivo, sin escala horizontal (Tz 100) ni elevación (Ts 0), relleno visible
 *   (Tr 0) en un color oscuro, dentro de la página, sin caracteres de control ni bytes sin definir;
 * - con fuentes estándar WinAnsi;
 * - sin pinturas posteriores que tapen su punto de inicio (ver pintura.ts).
 * Recortes (W), estados externos (gs), sombreados (sh), contenido marcado (capas) y cualquier operador
 * desconocido fallan cerrado. Límite conocido: no se miden anchos de letra (el texto se ubica por su inicio).
 */
import type { DocumentoPdf, FuenteEstandar, PaginaPdf } from "./documento";
import { ErrorPdf } from "./errores";
import { IDENTIDAD, por, traslacion, type Matriz } from "./geometria";
import { Lexico, leerValor, type PdfValor } from "./lexico";
import { Pintura, PINTURA_INICIAL, SOLO_FUERA_DE_TEXTO, type EstadoPintura } from "./pintura";
import { decodificarWinAnsi } from "./winansi";

export interface CeldaPdf {
  readonly pagina: number;
  readonly x: number;
  readonly y: number;
  readonly texto: string;
}

export const MAX_TEXTO_CELDA = 1024;
export const MAX_CELDAS = 10_000;
const MAX_OPERADORES = 500_000;
const MAX_OPERANDOS = 64;
const MAX_PILA_GRAFICA = 64;
/** Un ajuste de TJ de -250 milésimas o menos separa palabras. */
const AJUSTE_ESPACIO = -250;
const TAMANO_MINIMO = 1;
const EPSILON = 1e-6;
const ESCALA_NORMAL = 100;
/** Controles C0, DEL y U+FFFD (byte sin definir en WinAnsi): no son texto visible. */
const NO_VISIBLE = /[\u0000-\u001f\u007f�]/;

const redondear = (v: number) => Math.round(v * 100) / 100;

/** Parámetros de texto sin efecto en qué se ve ni dónde empieza (espaciado entre letras y palabras). */
const ESPACIADO = new Set(["Tc", "Tw"]);

/** Lo que guarda q y restaura Q (§8.4.2): la matriz, la pintura y los parámetros de texto. */
interface EstadoGrafico {
  readonly ctm: Matriz;
  readonly pintura: EstadoPintura;
  readonly fuente: FuenteEstandar | null;
  readonly tamano: number;
  readonly tl: number;
  readonly tr: number;
  readonly tz: number;
  readonly ts: number;
}

function numeros(a: readonly PdfValor[], cuantos: number): number[] {
  if (a.length !== cuantos || !a.every((v): v is number => typeof v === "number" && Number.isFinite(v))) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  return a as number[];
}

const matriz = (a: readonly PdfValor[]): Matriz => numeros(a, 6) as unknown as Matriz;

class Interprete {
  private g: EstadoGrafico = { ctm: IDENTIDAD, pintura: PINTURA_INICIAL, fuente: null, tamano: 0, tl: 0, tr: 0, tz: ESCALA_NORMAL, ts: 0 };
  private readonly pila: EstadoGrafico[] = [];
  private readonly pintura = new Pintura();
  private enTexto = false;
  private tm: Matriz = IDENTIDAD;
  private tlm: Matriz = IDENTIDAD;
  private continua = false;
  readonly celdas: CeldaPdf[] = [];

  constructor(private readonly pagina: PaginaPdf) {}

  ejecutar(op: string, a: readonly PdfValor[]): void {
    if (op === "q" || op === "Q" || op === "cm") return this.grafico(op, a);
    if (op === "BT" || op === "ET") return this.bloque(op, a);
    if (op === "Tf" || op === "TL" || op === "Tr" || op === "Tz" || op === "Ts") return this.estadoTexto(op, a);
    if (op === "Td" || op === "TD" || op === "Tm" || op === "T*") return this.posicion(op, a);
    if (op === "Tj" || op === "TJ" || op === "'" || op === '"') return this.mostrarOperador(op, a);
    if (ESPACIADO.has(op)) return void numeros(a, 1);
    if (this.enTexto && SOLO_FUERA_DE_TEXTO.has(op)) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    if (!this.pintura.ejecutar(op, a, this.g.ctm)) throw new ErrorPdf("PDF_OPERADOR_NO_SOPORTADO");
  }

  terminar(): void {
    if (this.enTexto || this.pila.length > 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  }

  /** q, Q y cm no van dentro de BT…ET (§8.2, figura 9): ahí se rechazan. */
  private grafico(op: string, a: readonly PdfValor[]): void {
    if (this.enTexto) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    if (op === "cm") {
      this.g = { ...this.g, ctm: por(matriz(a), this.g.ctm) };
      return;
    }
    if (a.length !== 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    if (op === "q") {
      if (this.pila.length >= MAX_PILA_GRAFICA) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      this.pila.push({ ...this.g, pintura: this.pintura.estado });
      return;
    }
    const previo = this.pila.pop();
    if (previo === undefined) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    this.g = previo;
    this.pintura.estado = previo.pintura;
  }

  private bloque(op: string, a: readonly PdfValor[]): void {
    if (a.length !== 0 || this.enTexto === (op === "BT")) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    this.enTexto = op === "BT";
    this.tm = IDENTIDAD;
    this.tlm = IDENTIDAD;
    this.continua = false;
  }

  private estadoTexto(op: string, a: readonly PdfValor[]): void {
    if (op !== "Tf") {
      const [v] = numeros(a, 1);
      const campo = ({ TL: "tl", Tr: "tr", Tz: "tz", Ts: "ts" } as const)[op as "TL" | "Tr" | "Tz" | "Ts"];
      this.g = { ...this.g, [campo]: v! };
      return;
    }
    const [nombre, tamano] = a;
    if (a.length !== 2 || typeof tamano !== "number" || !Number.isFinite(tamano) || typeof nombre !== "object" || nombre === null || nombre.tipo !== "nombre") {
      throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
    }
    const fuente = this.pagina.fuentes.get(nombre.v);
    if (!fuente) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
    this.g = { ...this.g, fuente, tamano };
  }

  private posicion(op: string, a: readonly PdfValor[]): void {
    this.exigirTexto();
    if (op === "Tm") this.tlm = matriz(a);
    else if (op === "T*") {
      if (a.length !== 0) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
      this.tlm = por(traslacion(0, -this.g.tl), this.tlm);
    } else {
      const [tx, ty] = numeros(a, 2);
      if (op === "TD") this.g = { ...this.g, tl: -ty! };
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

  /** Horizontal, sin espejo, de tamaño legible, sin Tz/Ts y visible (el color y el fondo los mira pintura.ts). */
  private seVe(m: Matriz): boolean {
    const { tr, tz, ts, tamano } = this.g;
    // Con tamano > 0, «m[3] · tamano ≥ 1» ya exige m[3] > 0: no hay espejo vertical.
    const horizontal = Math.abs(m[1]) < EPSILON && Math.abs(m[2]) < EPSILON && m[0] > 0;
    return horizontal && tr === 0 && tz === ESCALA_NORMAL && ts === 0 && tamano > 0 && m[3] * tamano >= TAMANO_MINIMO;
  }

  /** Piezas: bytes WinAnsi o un espacio que viene de un ajuste de TJ. */
  private mostrar(piezas: readonly (Uint8Array | " ")[]): void {
    if (!this.g.fuente?.conTexto) throw new ErrorPdf("PDF_FUENTE_NO_SOPORTADA");
    const m = por(this.tm, this.g.ctm);
    const [x, y] = [redondear(m[4]), redondear(m[5])];
    const dentro = x >= 0 && y >= 0 && x <= this.pagina.ancho && y <= this.pagina.alto;
    const texto = piezas.map((p) => (p === " " ? " " : decodificarWinAnsi(p))).join("");
    if (!this.seVe(m) || !dentro || NO_VISIBLE.test(texto)) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
    this.pintura.texto(m[4], m[5], m[3] * this.g.tamano, !this.continua);
    const previa = this.continua ? this.celdas.pop() : undefined;
    const celda = previa ? { ...previa, texto: previa.texto + texto } : { pagina: this.pagina.numero, x, y, texto };
    if (celda.texto.length > MAX_TEXTO_CELDA) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
    this.celdas.push(celda);
    this.continua = true;
  }
}

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
