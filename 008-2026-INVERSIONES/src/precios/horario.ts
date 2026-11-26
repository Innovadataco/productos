/**
 * Cuándo una barra diaria de Yahoo ya es un cierre (INV-SPEC-16).
 * La barra de hoy, antes de la hora definitiva, es un precio parcial: guardarla como cierre sería
 * presentar un precio viejo como de hoy. Se compara siempre en hora de Colombia (America/Bogota, UTC−5, sin horario de verano).
 */
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MINUTOS_POR_HORA = 60;

/**
 * Margen sobre el cierre de la BVC porque Yahoo puede publicar la barra definitiva con demora;
 * horario oficial por verificar. Según fuentes secundarias (Rankia, Valora Analitik), la rueda de
 * acciones va de 9:30 a 16:00 COT con el horario de invierno de Nueva York y de 8:30 a 15:00 COT
 * con el de verano: 17:00 queda después del cierre todo el año. Esas horas están por verificar
 * con la circular oficial de la BVC.
 */
export const HORA_BARRA_DEFINITIVA_COT = { hora: 17, minuto: 0 } as const;

/** Fecha de calendario en Colombia de un instante, a medianoche UTC. */
export function fechaEnBogota(ahora: Date): Date {
  const local = new Date(ahora.getTime() - DESFASE_BOGOTA_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function minutosDelDiaEnBogota(ahora: Date): number {
  const local = new Date(ahora.getTime() - DESFASE_BOGOTA_MS);
  return local.getUTCHours() * MINUTOS_POR_HORA + local.getUTCMinutes();
}

/** Día `AAAA-MM-DD` de una fecha a medianoche UTC (la clave de `noHabiles`). */
export const diaIso = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/**
 * ¿Hay rueda en la BVC ese día? Ni fin de semana (gana aunque el calendario diga hábil) ni festivo
 * (`esHabil = false` en calendario_bvc).
 */
export function esDiaHabil(fecha: Date, noHabiles: ReadonlySet<string>): boolean {
  const diaSemana = fecha.getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !noHabiles.has(diaIso(fecha));
}

/**
 * ¿La barra de `fecha` es definitiva? Días pasados, sí. Fechas futuras, no. La de hoy, solo si hoy
 * es día hábil (ni fin de semana ni festivo del calendario de la BVC) y ya pasó la hora definitiva.
 */
export function barraDefinitiva(fecha: Date, ahora: Date, noHabiles: ReadonlySet<string>): boolean {
  const hoy = fechaEnBogota(ahora);
  if (fecha.getTime() < hoy.getTime()) return true;
  if (fecha.getTime() > hoy.getTime()) return false;
  if (!esDiaHabil(hoy, noHabiles)) return false;
  return minutosDelDiaEnBogota(ahora) >= HORA_BARRA_DEFINITIVA_COT.hora * MINUTOS_POR_HORA + HORA_BARRA_DEFINITIVA_COT.minuto;
}
