/**
 * Programa del servicio inv-008-precios (D-018): una corrida de lunes a viernes a las 18:00 COT, después del cierre de
 * la BVC y de la hora en que la barra de Yahoo ya es definitiva (`HORA_BARRA_DEFINITIVA_COT`, 17:00). Colombia es
 * UTC−5 fijo, sin horario de verano. La próxima corrida es siempre la siguiente ESTRICTAMENTE después de «ahora»:
 * una corrida perdida (el contenedor arrancó después de las 18:00) no se recupera; los CLI traen los últimos 10 días
 * en cada corrida, así que el hueco se llena solo en la siguiente. No mira festivos: en uno, los CLI no guardan nada
 * de ese día (día no hábil).
 */
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
