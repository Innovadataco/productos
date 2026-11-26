/**
 * De las lecturas del plan a la vista de /plan (texto). Cálculo puro.
 * - Vigente hoy: la de mayor número con `vigenteDesde` ≤ hoy; programada: la que empieza después de hoy.
 * - Solo la vigente lleva cierres y distancia: el cierre de hoy contra una regla que no rige engañaría.
 * - El último cierre se compara con la fecha de referencia del tablero: «sin negociación desde…» si hay días hábiles
 *   de la BVC sin cierre en medio (`cierre-frescura.ts`), y entonces no hay distancia al nivel.
 */
import type { CierreLeido, ReglaLeida, VersionLeida } from "@/plan/lectura";
import { frescuraDelCierre, preciosAtrasados } from "@/plan/cierre-frescura";
import { estadoDelNivel } from "@/plan/niveles";
import { atrasoParaAviso } from "@/precios/atraso";
import type { CalendarioBvc } from "@/precios/negociacion";
import { horaColombia } from "../_comun/fecha-dato/hora";
import type { Procedencia } from "../_comun/fecha-dato/tipos";
import { dia, diaColombia } from "../_plan/serializar";
import type { CierreVista, NivelVista, ReglaVista, VersionVista, VistaPlan } from "../_plan/tipos";

export interface Cierres {
  readonly porEspecie: ReadonlyMap<string, CierreLeido>;
  readonly calendario: CalendarioBvc;
  /** La fecha de referencia del tablero (cierre más reciente entre las especies vivas). */
  readonly referencia: Date | null;
}

export const vigenteEn = (versiones: readonly VersionLeida[], hoy: Date): VersionLeida | null =>
  [...versiones].sort((a, b) => b.version - a.version).find((v) => v.vigenteDesde <= hoy) ?? null;

export function aVersionVista(v: VersionLeida, vigente: VersionLeida | null, elegida: VersionLeida | null, hoy: Date): VersionVista {
  const tipo = v.vigenteDesde > hoy ? "PROGRAMADA" : v.id === vigente?.id ? "VIGENTE" : "HISTORICA";
  return { numero: v.version, desde: dia(v.vigenteDesde), motivo: v.motivo, tipo, actual: v.id === elegida?.id };
}

function cierreDe(r: ReglaLeida, c: Cierres): CierreVista {
  if (r.instrumentoId === null) return { estado: "NO_APLICA" };
  const ultimo = c.porEspecie.get(r.instrumentoId);
  if (!ultimo) return { estado: r.conLotes ? "SIN_CIERRE" : "SIN_LOTES" };
  const base = { ultimo: dia(ultimo.fecha), precio: ultimo.precio.toString(), verificado: ultimo.estado === "VERIFICADO" };
  const f = frescuraDelCierre(ultimo.fecha, c.referencia, c.calendario);
  if (f.estado === "SIN_NEGOCIACION") return { estado: "SIN_NEGOCIACION", desde: dia(f.desde), ...base };
  if (f.estado === "SIN_CALENDARIO") return { estado: "SIN_CALENDARIO", anio: f.anio, ...base };
  return { estado: "AL_DIA", ...base };
}

/**
 * El último cierre de la especie: su día, cuándo lo trajo 008 (hora de Colombia), la fuente y, con el instante de la
 * lectura (`ahora`), los días hábiles de la BVC que lleva sin renovarse (frente fuente-retraso).
 */
function procedenciaDe(r: ReglaLeida, c: Cierres, ahora: Date | undefined): Procedencia | null {
  const ultimo = r.instrumentoId === null ? undefined : c.porEspecie.get(r.instrumentoId);
  if (!ultimo) return null;
  return {
    dia: dia(ultimo.fecha), traidoEn: ultimo.traidoEn ? horaColombia(ultimo.traidoEn) : null, fuente: ultimo.fuente ?? null,
    ...(ahora === undefined ? {} : { habilesAtras: atrasoParaAviso(ultimo.fecha, ahora, c.calendario) }),
  };
}

function frenteDe(r: ReglaLeida, cierre: CierreVista, c: Cierres): NivelVista {
  if (r.instrumentoId === null) return { estado: "SIN_NIVEL" };
  const alDia = cierre.estado === "AL_DIA" ? (c.porEspecie.get(r.instrumentoId)?.precio ?? null) : null;
  const e = estadoDelNivel(r.condicion, r.nivel, alDia);
  return e.estado === "A_DISTANCIA" ? { estado: "A_DISTANCIA", distanciaPct: e.distanciaPct.toString() } : e;
}

function aReglaVista(r: ReglaLeida, cierres: Cierres | null, hoy: Date, ahora: Date | undefined): ReglaVista {
  const cierre = cierres ? cierreDe(r, cierres) : null;
  return {
    id: r.id,
    especie: r.nemotecnico,
    condicion: r.condicion,
    nivel: r.nivel?.toString() ?? null,
    accion: r.accion,
    cantidad: r.cantidad?.toString() ?? null,
    plazo: r.plazoHasta ? dia(r.plazoHasta) : null,
    plazoVencido: r.plazoHasta !== null && r.plazoHasta < hoy,
    detalle: r.detalle,
    decisiones: r.decisiones,
    cierre,
    frente: cierres && cierre ? frenteDe(r, cierre, cierres) : null,
    procedencia: cierres ? procedenciaDe(r, cierres, ahora) : null,
  };
}

/** Las especies de la A a la Z; las de portafolio, al final (en el orden de la base). */
const porEspecie = (a: ReglaVista, b: ReglaVista): number => {
  if (a.especie === null || b.especie === null) return Number(a.especie === null) - Number(b.especie === null);
  return a.especie.localeCompare(b.especie);
};

export interface EntradaVistaPlan {
  readonly versiones: readonly VersionLeida[];
  readonly elegida: VersionLeida;
  readonly reglas: readonly ReglaLeida[];
  /** null si la elegida no es la vigente. */
  readonly cierres: Cierres | null;
  readonly hoy: Date;
  /** El instante de la lectura, para contar los días hábiles de atraso de cada cierre; sin él, no se cuentan. */
  readonly ahora?: Date;
}

export function aVistaPlan(e: EntradaVistaPlan): VistaPlan {
  const vigente = vigenteEn(e.versiones, e.hoy);
  const reglas = e.reglas.map((r) => aReglaVista(r, e.cierres, e.hoy, e.ahora)).sort(porEspecie);
  const programada = [...e.versiones].filter((v) => v.vigenteDesde > e.hoy).sort((a, b) => a.version - b.version)[0] ?? null;
  return {
    version: aVersionVista(e.elegida, vigente, e.elegida, e.hoy),
    aprobadaEl: diaColombia(e.elegida.creadaEn),
    reglas,
    conCierres: e.cierres !== null,
    referencia: e.cierres?.referencia ? dia(e.cierres.referencia) : null,
    preciosAtrasados: e.cierres ? preciosAtrasados(e.cierres.referencia, e.hoy, e.cierres.calendario) : false,
    hayInferencia: reglas.some((r) => r.cierre?.estado === "SIN_NEGOCIACION"),
    programada: programada && programada.id !== e.elegida.id ? aVersionVista(programada, vigente, e.elegida, e.hoy) : null,
  };
}
