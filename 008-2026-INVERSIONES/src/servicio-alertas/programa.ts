/**
 * Programa del servicio inv-008-alertas: las RANURAS en que evalúa, de lunes a viernes en hora de Colombia (UTC−5 fijo).
 * - La del cierre, a las 18:15: después de la corrida de precios de las 18:00, que ya guardó los cierres del día.
 * - Con el intradía encendido (INV_INTRADIA_ENCENDIDO, el mismo interruptor de los precios), además cada 5 minutos en la rueda, de
 *   las 9:30 a las 16:05 (incluidas): la BVC cierra a las 16:00 y el dato intradía llega con unos minutos de retraso.
 * Los festivos de la BVC los mira el bucle con el calendario: aquí solo hay fines de semana. Es la misma aritmética de
 * src/servicio-precios/programa.ts y src/servicio-ia/programa.ts (hora fija de Colombia, sin horario de verano).
 */
const DESFASE_COT_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;
const SABADO = 6;
const DOMINGO = 0;

const CIERRE_MIN = 18 * 60 + 15;
const RUEDA_DESDE_MIN = 9 * 60 + 30;
const RUEDA_HASTA_MIN = 16 * 60 + 5;
const RUEDA_CADA_MIN = 5;

/** Los minutos desde la medianoche de Colombia en que hay ranura, de menor a mayor. */
export function ranurasDelDia(intradia: boolean): readonly number[] {
  const rueda: number[] = [];
  if (intradia) for (let m = RUEDA_DESDE_MIN; m <= RUEDA_HASTA_MIN; m += RUEDA_CADA_MIN) rueda.push(m);
  return [...rueda, CIERRE_MIN];
}

/** La medianoche de Colombia del día de `instante`, como instante. */
const medianocheCot = (instante: number): number => {
  const local = new Date(instante - DESFASE_COT_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + DESFASE_COT_MS;
};

const esFinDeSemana = (medianoche: number): boolean => {
  const dia = new Date(medianoche - DESFASE_COT_MS).getUTCDay();
  return dia === SABADO || dia === DOMINGO;
};

/** La siguiente ranura (lunes a viernes) estrictamente después de `ahora`. */
export function proximaRanura(ahora: Date, intradia: boolean): Date {
  const t = ahora.getTime();
  if (!Number.isFinite(t)) throw new RangeError("proximaRanura: fecha inválida");
  const ranuras = ranurasDelDia(intradia);
  for (let medianoche = medianocheCot(t); ; medianoche += DIA_MS) {
    if (esFinDeSemana(medianoche)) continue;
    const siguiente = ranuras.map((m) => medianoche + m * MINUTO_MS).find((r) => r > t);
    if (siguiente !== undefined) return new Date(siguiente);
  }
}

/** Las 18:15 del día de Colombia de `ahora`, o null si ese día es sábado o domingo. Sirve para recuperar la del día si el servicio arrancó tarde. */
export function cierreDeHoy(ahora: Date): Date | null {
  const medianoche = medianocheCot(ahora.getTime());
  return esFinDeSemana(medianoche) ? null : new Date(medianoche + CIERRE_MIN * MINUTO_MS);
}

/** ¿Es la ranura del cierre (las 18:15) y no una de la rueda? */
export function esRanuraDeCierre(instante: Date): boolean {
  return Math.round((instante.getTime() - medianocheCot(instante.getTime())) / MINUTO_MS) === CIERRE_MIN;
}
