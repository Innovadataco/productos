/**
 * Cuándo una barra diaria de Yahoo ya es un cierre (INV-SPEC-16).
 * La barra de hoy, antes del cierre de la BVC, es un precio parcial: guardarla como cierre sería
 * presentar un precio viejo como de hoy. Se compara siempre en hora de Colombia (America/Bogota, UTC−5, sin horario de verano).
 */
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MINUTOS_POR_HORA = 60;

/** Cierre de la rueda de la BVC en hora de Colombia (margen conservador sobre la subasta de cierre). */
export const HORA_CIERRE_BVC = { hora: 16, minuto: 0 } as const;

/** Fecha de calendario en Colombia de un instante, a medianoche UTC. */
export function fechaEnBogota(ahora: Date): Date {
  const local = new Date(ahora.getTime() - DESFASE_BOGOTA_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

function minutosDelDiaEnBogota(ahora: Date): number {
  const local = new Date(ahora.getTime() - DESFASE_BOGOTA_MS);
  return local.getUTCHours() * MINUTOS_POR_HORA + local.getUTCMinutes();
}

/**
 * ¿La barra de `fecha` es definitiva? Días pasados, sí. Fechas futuras, no. La de hoy, solo si hoy
 * es día hábil (ni fin de semana ni festivo del calendario de la BVC) y ya pasó la hora de cierre.
 */
export function barraDefinitiva(fecha: Date, ahora: Date, noHabiles: ReadonlySet<string>): boolean {
  const hoy = fechaEnBogota(ahora);
  if (fecha.getTime() < hoy.getTime()) return true;
  if (fecha.getTime() > hoy.getTime()) return false;
  const diaSemana = hoy.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6 || noHabiles.has(hoy.toISOString().slice(0, 10))) return false;
  return minutosDelDiaEnBogota(ahora) >= HORA_CIERRE_BVC.hora * MINUTOS_POR_HORA + HORA_CIERRE_BVC.minuto;
}
