/**
 * Programa del servicio inv-008-precios (D-018): una corrida de lunes a viernes a las 18:00 COT, después del cierre de
 * la BVC y de la hora en que la barra de Yahoo ya es definitiva (`HORA_BARRA_DEFINITIVA_COT`, 17:00). Colombia es
 * UTC−5 fijo, sin horario de verano. La próxima corrida es siempre la siguiente ESTRICTAMENTE después de «ahora»:
 * una corrida perdida (el contenedor arrancó después de las 18:00) no se recupera; los CLI traen los últimos 10 días
 * en cada corrida, así que el hueco se llena solo en la siguiente. No mira festivos: en uno, los CLI no guardan nada
 * de ese día (día no hábil).
 */
import { fechaEnBogota } from "../precios/horario";

const DESFASE_COT_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const SABADO = 6;
const DOMINGO = 0;

export const HORA_CORRIDA_COT = { hora: 18, minuto: 0 } as const;

/** La siguiente corrida (lunes a viernes, 18:00 COT) estrictamente después de `ahora`. */
export function proximaCorrida(ahora: Date): Date {
  const t = ahora.getTime();
  if (!Number.isFinite(t)) throw new RangeError("proximaCorrida: fecha inválida");
  const local = new Date(t - DESFASE_COT_MS);
  // Las 18:00 COT del día de Colombia de `ahora`, como instante.
  let candidata = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), HORA_CORRIDA_COT.hora, HORA_CORRIDA_COT.minuto) + DESFASE_COT_MS;
  while (candidata <= t || esFinDeSemana(candidata)) candidata += DIA_MS;
  return new Date(candidata);
}

function esFinDeSemana(instante: number): boolean {
  const dia = new Date(instante - DESFASE_COT_MS).getUTCDay();
  return dia === SABADO || dia === DOMINGO;
}

/** «2027-01-08 18:00 COT»: el instante en hora de Colombia, al minuto (para el log). */
export function textoCot(instante: Date): string {
  const local = new Date(instante.getTime() - DESFASE_COT_MS).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 16)} COT`;
}

// ───────────── La ventana del ciclo intradía (precios cada minuto) ─────────────
const MINUTOS_POR_HORA = 60;

/** La hora de Colombia de un instante, como una fecha UTC corrida (para leer día, hora y minuto con los getters UTC). */
const localCot = (instante: number): Date => new Date(instante - DESFASE_COT_MS);

/**
 * ¿Está el instante dentro de la ventana del ciclo intradía? De lunes a viernes, desde `desdeMin` (incluido) hasta `hastaMin`
 * (excluido), en minutos desde la medianoche de Colombia. No mira festivos: en uno, el ciclo se da cuenta (calendario_bvc) y
 * el servicio no insiste ese día.
 */
export function enVentanaIntradia(instante: number, desdeMin: number, hastaMin: number): boolean {
  if (!Number.isFinite(instante)) return false;
  const local = localCot(instante);
  const dia = local.getUTCDay();
  if (dia === SABADO || dia === DOMINGO) return false;
  const minutos = local.getUTCHours() * MINUTOS_POR_HORA + local.getUTCMinutes();
  return minutos >= desdeMin && minutos < hastaMin;
}

/** «AAAA-MM-DD» de Colombia del instante. */
export function diaCot(instante: number): string {
  return fechaEnBogota(new Date(instante)).toISOString().slice(0, 10);
}

/** Lo más que espera el ciclo intradía tras un 429 de Yahoo. */
export const MAXIMA_ESPERA_MS = 15 * 60_000;
const MAXIMO_EXPONENTE = 30;

/**
 * La espera antes del siguiente ciclo tras `fallos` limitaciones (429) seguidas: el ciclo por 2 elevado al número de fallos
 * (exponencial), con tope en MAXIMA_ESPERA_MS. Sin fallos, ninguna.
 */
export function esperaTrasFallos(fallos: number, cicloMs: number): number {
  if (!(fallos > 0)) return 0;
  return Math.min(cicloMs * 2 ** Math.min(fallos, MAXIMO_EXPONENTE), MAXIMA_ESPERA_MS);
}
