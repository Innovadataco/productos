/**
 * Color, trazados, rellenos e imágenes de una página (ISO 32000-1 §8.4-8.9), lo justo para garantizar que
 * el texto extraído se ve:
 * - el texto se pinta en un color oscuro (luminancia ≤ 0,5);
 * - lo que haya DEBAJO (el último relleno o trazo grueso que contiene sus puntos de muestra) contrasta con
 *   él al menos 0,3; un fondo de color no evaluable o una imagen debajo del texto se rechazan;
 * - ninguna pintura opaca POSTERIOR (relleno, trazo grueso o imagen) contiene uno de sus puntos de muestra.
 * Puntos de muestra de un texto: su origen en la línea base y dos puntos dentro del primer glifo (a 0,3 y a
 * 0,6 del tamaño, corridos 0,25 a la derecha), para que un tapado que arranca en la línea base cuente.
 * El portal de A&V pinta las celdas con `re B` en grises claros antes de cada texto y escribe en negro o gris
 * oscuro (verificado en local, solo conteos, sobre la certificación real).
 * Límite conocido: no se miden anchos de letra; un tapado que deja libre el primer glifo no se detecta.
 */
import { ErrorPdf } from "./errores";
import { ampliar, aplicar, cajaDe, contiene, type Caja, type Matriz } from "./geometria";
import type { PdfValor } from "./lexico";

/** Más claro que esto (0 negro, 1 blanco) no se acepta como color de texto. */
export const LUMINANCIA_MAXIMA_TEXTO = 0.5;
/** Diferencia mínima de luminancia entre el texto y el fondo que tiene debajo. */
export const CONTRASTE_MINIMO = 0.3;
/** Un trazo de hasta este grosor (en puntos de la página) no tapa un texto. */
export const GROSOR_INOFENSIVO = 2;
const MAX_PUNTOS_TRAZADO = 4096;
/** Pinturas opacas por página (rellenos, trazos gruesos e imágenes): el portal pinta menos de cien. */
const MAX_PINTURAS = 2000;

export interface EstadoPintura {
  /** Luminancia del color de relleno; null si viene de un espacio de color que no se evalúa (cs/sc/scn). */
  readonly relleno: number | null;
  /** Luminancia del color de trazo; null si no se evalúa (CS/SC/SCN). */
  readonly trazo: number | null;
  readonly grosor: number;
}

export const PINTURA_INICIAL: EstadoPintura = { relleno: 0, trazo: 0, grosor: 1 };

/** Lo pintado de forma opaca: su caja y su luminancia (null = imagen o color no evaluable). */
interface Pintado {
  readonly caja: Caja;
  readonly luz: number | null;
}

type Punto = readonly [number, number];

const RELLENOS = new Set(["f", "F", "f*", "B", "B*", "b", "b*"]);
const TRAZOS = new Set(["S", "s"]);
const CONSTRUCCION = new Set(["m", "l", "c", "v", "y", "re", "h"]);
const SIN_EFECTO = new Set(["J", "j", "M", "d", "ri", "i"]);
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

/** Luminancia de un color en DeviceGray (g/G), DeviceRGB (rg/RG) o DeviceCMYK (k/K). */
export function luminancia(op: string, a: readonly PdfValor[]): number {
  const tipo = op.toLowerCase();
  if (tipo === "g") return componentes(a, 1)[0]!;
  if (tipo === "rg") {
    const [r, g, b] = componentes(a, 3);
    return luz(r!, g!, b!);
  }
  const [c, m, y, k] = componentes(a, 4);
  return luz((1 - c!) * (1 - k!), (1 - m!) * (1 - k!), (1 - y!) * (1 - k!));
}

const escala = (m: Matriz) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
const COLOR_RELLENO = new Set(["g", "rg", "k"]);
const COLOR_TRAZO = new Set(["G", "RG", "K"]);

export class Pintura {
  estado: EstadoPintura = PINTURA_INICIAL;
  private puntos: Punto[] = [];
  /** Puntos de muestra de los textos ya pintados en la página. */
  private readonly muestras: Punto[] = [];
  private readonly pintados: Pintado[] = [];

  /** Ejecuta un operador de color, trazado o pintura. Devuelve false si no es de esta familia. */
  ejecutar(op: string, a: readonly PdfValor[], ctm: Matriz): boolean {
    if (COLOR_RELLENO.has(op)) this.estado = { ...this.estado, relleno: luminancia(op, a) };
    else if (COLOR_TRAZO.has(op)) this.estado = { ...this.estado, trazo: luminancia(op, a) };
    else if (op === "cs" || op === "sc" || op === "scn") this.estado = { ...this.estado, relleno: null };
    else if (op === "CS" || op === "SC" || op === "SCN") this.estado = { ...this.estado, trazo: null };
    else if (op === "w") this.estado = { ...this.estado, grosor: Math.max(0, numeros(a, 1)[0]!) };
    else if (CONSTRUCCION.has(op)) this.construir(op, a, ctm);
    else if (RELLENOS.has(op)) this.rellenar();
    else if (TRAZOS.has(op)) this.trazar(ctm);
    else if (op === "Do") this.pintar(cajaDe([[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => aplicar(ctm, x!, y!))), null);
    else if (op !== "n" && !SIN_EFECTO.has(op)) return false;
    if (RELLENOS.has(op) || TRAZOS.has(op) || op === "n") this.puntos = [];
    return true;
  }

  /**
   * Un texto que empieza en (x, y) con tamaño efectivo `tamano`: valida su color y su fondo y, si es una celda
   * nueva (`registrar`), guarda sus puntos de muestra. Un Tj que sigue la misma celda se valida sin registrarse.
   */
  texto(x: number, y: number, tamano: number, registrar: boolean): void {
    const relleno = this.estado.relleno;
    if (relleno === null || relleno > LUMINANCIA_MAXIMA_TEXTO) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
    const puntos: Punto[] = [[x, y], [x + 0.25 * tamano, y + 0.3 * tamano], [x + 0.25 * tamano, y + 0.6 * tamano]];
    for (const [px, py] of puntos) {
      const fondo = this.pintados.findLast((p) => contiene(p.caja, px, py));
      if (fondo && (fondo.luz === null || Math.abs(fondo.luz - relleno) < CONTRASTE_MINIMO)) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
    }
    if (registrar) this.muestras.push(...puntos);
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

  private rellenar(): void {
    if (this.puntos.length > 0) this.pintar(cajaDe(this.puntos), this.estado.relleno);
  }

  private trazar(ctm: Matriz): void {
    const grosor = this.estado.grosor * escala(ctm);
    if (grosor > GROSOR_INOFENSIVO && this.puntos.length > 0) this.pintar(ampliar(cajaDe(this.puntos), grosor / 2), this.estado.trazo);
  }

  /** Una pintura opaca: no puede tapar un texto ya pintado, y queda como fondo de los que vengan. */
  private pintar(caja: Caja, luzPintura: number | null): void {
    if (this.pintados.length >= MAX_PINTURAS) throw new ErrorPdf("PDF_DEMASIADO_TEXTO");
    if (this.muestras.some(([x, y]) => contiene(caja, x, y))) throw new ErrorPdf("PDF_TEXTO_NO_SOPORTADO");
    this.pintados.push({ caja, luz: luzPintura });
  }
}
