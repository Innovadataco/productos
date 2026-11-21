/**
 * Color, trazados, rellenos e imágenes de una página (ISO 32000-1 §8.4-8.9), lo justo para garantizar que
 * el texto extraído se ve: el relleno con que se pinta el texto debe ser oscuro, y ninguna pintura opaca
 * posterior (relleno, trazo grueso o imagen) puede tapar el punto donde empieza un texto ya pintado.
 * El portal de A&V pinta las celdas de la tabla con `re B` en grises claros ANTES de cada texto (verificado:
 * 0 de sus pinturas tapan un texto previo) y escribe en negro o gris oscuro.
 * Límite conocido: se mira el punto de inicio del texto, no todo su ancho.
 */
import { ErrorPdf } from "./errores";
import { ampliar, aplicar, cajaDe, contiene, type Caja, type Matriz } from "./geometria";
import type { PdfValor } from "./lexico";

/** Más claro que esto (0 negro, 1 blanco) no se acepta como color de texto. */
export const LUMINANCIA_MAXIMA_TEXTO = 0.5;
/** Un trazo de hasta este grosor (en puntos de la página) no tapa un texto. */
export const GROSOR_INOFENSIVO = 2;
const MAX_PUNTOS_TRAZADO = 4096;
const MAX_PINTURAS_TRAS_TEXTO = 2000;

export interface EstadoPintura {
  /** Luminancia del color de relleno; null si viene de un espacio de color que no se evalúa (cs/sc/scn). */
  readonly relleno: number | null;
  readonly grosor: number;
}

export const PINTURA_INICIAL: EstadoPintura = { relleno: 0, grosor: 1 };

const RELLENOS = new Set(["f", "F", "f*", "B", "B*", "b", "b*"]);
const TRAZOS = new Set(["S", "s"]);
const CONSTRUCCION = new Set(["m", "l", "c", "v", "y", "re", "h"]);
const SIN_EFECTO = new Set(["J", "j", "M", "d", "ri", "i", "G", "RG", "K", "CS", "SC", "SCN"]);
/** Operadores que no pueden ir dentro de BT…ET (§8.2, figura 9). */
export const SOLO_FUERA_DE_TEXTO = new Set([...RELLENOS, ...TRAZOS, ...CONSTRUCCION, "n", "Do"]);

function numeros(a: readonly PdfValor[], cuantos: number): number[] {
  if (a.length !== cuantos || !a.every((v): v is number => typeof v === "number" && Number.isFinite(v))) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  return a as number[];
}

function componentes(a: readonly PdfValor[], cuantos: number): number[] {
  const v = numeros(a, cuantos);
  if (v.some((x) => x < 0 || x > 1)) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  return v;
}

const luz = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Luminancia de un color de relleno en DeviceGray (g), DeviceRGB (rg) o DeviceCMYK (k). */
export function luminancia(op: "g" | "rg" | "k", a: readonly PdfValor[]): number {
  if (op === "g") return componentes(a, 1)[0]!;
  if (op === "rg") {
    const [r, g, b] = componentes(a, 3);
    return luz(r!, g!, b!);
  }
  const [c, m, y, k] = componentes(a, 4);
  return luz((1 - c!) * (1 - k!), (1 - m!) * (1 - k!), (1 - y!) * (1 - k!));
}

const escala = (m: Matriz) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export class Pintura {
  estado: EstadoPintura = PINTURA_INICIAL;
  private puntos: (readonly [number, number])[] = [];
  private readonly anclas: (readonly [number, number])[] = [];
  private pinturasTrasTexto = 0;

  /** Ejecuta un operador de color, trazado o pintura. Devuelve false si no es de esta familia. */
  ejecutar(op: string, a: readonly PdfValor[], ctm: Matriz): boolean {
    if (op === "g" || op === "rg" || op === "k") this.estado = { ...this.estado, relleno: luminancia(op, a) };
    else if (op === "cs" || op === "sc" || op === "scn") this.estado = { ...this.estado, relleno: null };
    else if (op === "w") this.estado = { ...this.estado, grosor: Math.max(0, numeros(a, 1)[0]!) };
    else if (CONSTRUCCION.has(op)) this.construir(op, a, ctm);
    else if (RELLENOS.has(op)) this.pintar(this.puntos.length > 0 ? cajaDe(this.puntos) : null);
    else if (TRAZOS.has(op)) this.trazar(ctm);
    else if (op === "Do") this.pintar(cajaDe([[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => aplicar(ctm, x!, y!))));
    else if (op !== "n" && !SIN_EFECTO.has(op)) return false;
    if (RELLENOS.has(op) || TRAZOS.has(op) || op === "n") this.puntos = [];
    return true;
  }

  /** Registra dónde empieza un texto ya pintado. */
  anclar(x: number, y: number): void {
    this.anclas.push([x, y]);
  }

  textoLegible(): boolean {
    return this.estado.relleno !== null && this.estado.relleno <= LUMINANCIA_MAXIMA_TEXTO;
  }

  private construir(op: string, a: readonly PdfValor[], ctm: Matriz): void {
    const cuantos: Readonly<Record<string, number>> = { m: 2, l: 2, c: 6, v: 4, y: 4, re: 4, h: 0 };
    const v = numeros(a, cuantos[op]!);
    const locales: [number, number][] = [];
    if (op === "re") {
      const [x, y, w, h] = v;
      locales.push([x!, y!], [x! + w!, y!], [x!, y! + h!], [x! + w!, y! + h!]);
    } else for (let i = 0; i + 1 < v.length; i += 2) locales.push([v[i]!, v[i + 1]!]);
    this.puntos.push(...locales.map(([x, y]) => aplicar(ctm, x, y)));
    if (this.puntos.length > MAX_PUNTOS_TRAZADO) throw new ErrorPdf("PDF_CONTENIDO_INVALIDO");
  }

  private trazar(ctm: Matriz): void {
    const grosor = this.estado.grosor * escala(ctm);
    if (grosor > GROSOR_INOFENSIVO && this.puntos.length > 0) this.pintar(ampliar(cajaDe(this.puntos), grosor / 2));
  }

  private pintar(caja: Caja | null): void {
    if (caja === null || this.anclas.length === 0) return;
    this.pinturasTrasTexto += 1;
    if (this.pinturasTrasTexto > MAX_PINTURAS_TRAS_TEXTO) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
    if (this.anclas.some(([x, y]) => contiene(caja, x, y))) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
  }
}
