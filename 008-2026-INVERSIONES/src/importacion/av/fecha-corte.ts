/**
 * Fecha de corte de la certificación: el texto del PDF no la trae (solo la fecha de generación), así que la da
 * el dueño (`--fecha-corte`) y NUNCA se infiere. Se valida: día hábil de la BVC con su año sembrado, no futura,
 * no posterior a la fecha de generación del PDF y no más de 7 días antes (propuesta; por verificar con el dueño
 * si A&V corta al cierre del día de generación o al del día anterior). Fechas de negocio en hora de Colombia.
 * Una fecha no hábil (también la de un PDF generado en fin de semana o festivo) se rechaza y NUNCA se ajusta: el CLI
 * dice cuál es el último día hábil anterior según calendario_bvc (`ultimoHabilAnterior`) y cómo correrlo de nuevo.
 * Corte real (frente certificacion-corte-real): un PDF generado el MISMO día del corte antes de que el cierre de ese
 * día fuera definitivo (`barraDefinitiva`, la hora de los precios) no puede ser al cierre de ese día:
 * FECHA_CORTE_ANTES_DEL_CIERRE. Para ese rechazo y para FECHA_CORTE_POSTERIOR_AL_PDF se sugiere el último día hábil
 * cuyo cierre ya era definitivo al generarse el PDF (`ultimoCorteDefinitivo`). Sin CreationDate no se bloquea.
 */
import type { PrismaClient } from "@prisma/client";
import { barraDefinitiva, fechaEnBogota } from "../../precios/horario";

export const MAX_DIAS_ANTES_DEL_PDF = 7;
const DIA_MS = 24 * 60 * 60 * 1000;
const COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** Lo que dice calendario_bvc: los festivos entre semana (los fines de semana no se guardan) y los años sembrados enteros. */
export interface CalendarioCorte {
  readonly noHabiles: ReadonlySet<string>;
  readonly aniosSembrados: ReadonlySet<number>;
}

export interface ContextoFechaCorte extends CalendarioCorte {
  readonly hoy: Date;
  readonly creadoEn: Date | null;
}

export const isoDia = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Años con el calendario de la BVC sembrado ENTERO. La siembra guarda solo los festivos entre semana: un año cuenta
 * si trae alguno de enero y alguno de diciembre. Siempre los hay: Reyes Magos pasa a un lunes de enero, y de los
 * fijos 8 y 25 de diciembre al menos uno cae entre semana. Así un año sembrado a medias no pasa.
 */
export function aniosSembrados(diasNoHabiles: readonly Date[]): Set<number> {
  const meses = new Set(diasNoHabiles.map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`));
  const anios = new Set(diasNoHabiles.map((d) => d.getUTCFullYear()));
  return new Set([...anios].filter((a) => meses.has(`${a}-0`) && meses.has(`${a}-11`)));
}
/** Un instante → su fecha en Colombia (UTC−5, sin horario de verano). */
const diaEnColombia = (instante: Date): string => isoDia(new Date(instante.getTime() - COLOMBIA_MS));

/** El calendario desde los días no hábiles de calendario_bvc. */
export function calendarioDe(diasNoHabiles: readonly Date[]): CalendarioCorte {
  return { noHabiles: new Set(diasNoHabiles.map(isoDia)), aniosSembrados: aniosSembrados(diasNoHabiles) };
}

/** Lee calendario_bvc con la misma consulta que la importación (solo los días no hábiles). */
export async function leerCalendarioCorte(db: Pick<PrismaClient, "calendarioBvc">): Promise<CalendarioCorte> {
  const filas = await db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } });
  return calendarioDe(filas.map((f) => f.dia));
}

const esFinDeSemana = (d: Date): boolean => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const diaAnterior = (d: Date): Date => new Date(d.getTime() - DIA_MS);

export type UltimoHabil = { readonly ok: true; readonly dia: string } | { readonly ok: false; readonly anioSinCalendario: number };

/**
 * Por qué la fecha de corte dada no es el corte real y qué día sugiere el CLI (nunca se aplica solo):
 * - PDF: la CreationDate del PDF (señal 2): el último día hábil con el cierre ya definitivo a esa hora;
 * - PRECIOS: los precios de valoración cuadran con los cierres del día hábil anterior (señal 1), con los conteos.
 */
export type PistaCorte =
  | { readonly tipo: "PDF"; readonly generadoEn: Date; readonly sugerido: UltimoHabil }
  | { readonly tipo: "PRECIOS"; readonly sugerido: string; readonly especies: number; readonly distintas: number };

/**
 * El último día hábil de la BVC ANTERIOR a `fecha`, según calendario_bvc. Un fin de semana nunca es hábil; un día
 * entre semana solo se da por hábil si su año está sembrado entero: si no, devuelve ese año y no adivina.
 * Siempre termina: hacia atrás se llega a un día entre semana de un año sin sembrar.
 */
export function ultimoHabilAnterior(fecha: Date, cal: CalendarioCorte): UltimoHabil {
  for (let d = diaAnterior(new Date(`${isoDia(fecha)}T00:00:00Z`)); ; d = diaAnterior(d)) {
    if (esFinDeSemana(d)) continue;
    if (!cal.aniosSembrados.has(d.getUTCFullYear())) return { ok: false, anioSinCalendario: d.getUTCFullYear() };
    if (!cal.noHabiles.has(isoDia(d))) return { ok: true, dia: isoDia(d) };
  }
}

/**
 * El último día hábil de la BVC cuyo cierre ya era definitivo cuando se generó el PDF: el mismo día de creación si es
 * hábil y ya pasó la hora definitiva (`barraDefinitiva`); si no, `ultimoHabilAnterior` de ese día. Día en hora de
 * Colombia. Un día entre semana de un año sin sembrar devuelve ese año: no adivina.
 */
export function ultimoCorteDefinitivo(creadoEn: Date, cal: CalendarioCorte): UltimoHabil {
  const generado = fechaEnBogota(creadoEn);
  if (!esFinDeSemana(generado)) {
    if (!cal.aniosSembrados.has(generado.getUTCFullYear())) return { ok: false, anioSinCalendario: generado.getUTCFullYear() };
    if (barraDefinitiva(generado, creadoEn, cal.noHabiles)) return { ok: true, dia: isoDia(generado) };
  }
  return ultimoHabilAnterior(generado, cal);
}

/** Día y hora (hh:mm) en Colombia de un instante, para los mensajes. */
export function diaYHoraEnColombia(instante: Date): { readonly dia: string; readonly hora: string } {
  const local = new Date(instante.getTime() - COLOMBIA_MS);
  return { dia: isoDia(local), hora: local.toISOString().slice(11, 16) };
}

export function validarFechaCorte(fecha: Date, ctx: ContextoFechaCorte): string | null {
  const dia = isoDia(fecha);
  if (esFinDeSemana(fecha) || ctx.noHabiles.has(dia)) return "FECHA_CORTE_NO_HABIL";
  if (!ctx.aniosSembrados.has(fecha.getUTCFullYear())) return "CALENDARIO_BVC_INCOMPLETO";
  if (dia > diaEnColombia(ctx.hoy)) return "FECHA_CORTE_FUTURA";
  if (ctx.creadoEn === null) return null;
  const generado = diaEnColombia(ctx.creadoEn);
  if (dia > generado) return "FECHA_CORTE_POSTERIOR_AL_PDF";
  // Mismo día de creación: solo si ya pasó la hora definitiva del cierre (la de los precios, no una nueva).
  if (dia === generado && !barraDefinitiva(fecha, ctx.creadoEn, ctx.noHabiles)) return "FECHA_CORTE_ANTES_DEL_CIERRE";
  const minimo = isoDia(new Date(new Date(`${generado}T00:00:00Z`).getTime() - MAX_DIAS_ANTES_DEL_PDF * DIA_MS));
  return dia < minimo ? "FECHA_CORTE_LEJANA" : null;
}
