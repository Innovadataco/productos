/**
 * Programa del servicio inv-008-ia: las RANURAS son las horas en punto que Jelk puede elegir en /edicion/ia
 * (`HORAS_RESUMEN`, 19:00 por omisión), de lunes a viernes en hora de Colombia (UTC−5 fijo). En cada ranura el bucle lee
 * la configuración vigente y corre solo si esa es SU hora: así un cambio de hora en la pantalla vale sin reiniciar el
 * servicio y la base se lee, como mucho, una vez por ranura. Los festivos de la BVC los mira el bucle en el calendario.
 * Una ranura perdida (el contenedor arrancó después) no se recupera.
 */
import { HORAS_RESUMEN, type HoraResumen } from "../ia/config/parametros";

const DESFASE_COT_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const SABADO = 6;
const DOMINGO = 0;
const HORAS = HORAS_RESUMEN.map((h) => Number(h.slice(0, 2)));

const esFinDeSemana = (instante: number): boolean => {
  const dia = new Date(instante - DESFASE_COT_MS).getUTCDay();
  return dia === SABADO || dia === DOMINGO;
};

/** La siguiente ranura (lunes a viernes, una hora de la lista) estrictamente después de `ahora`. */
export function proximaRanura(ahora: Date): Date {
  const t = ahora.getTime();
  if (!Number.isFinite(t)) throw new RangeError("proximaRanura: fecha inválida");
  const local = new Date(t - DESFASE_COT_MS);
  let medianoche = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + DESFASE_COT_MS;
  for (;;) {
    const ranura = esFinDeSemana(medianoche) ? undefined : HORAS.map((h) => medianoche + h * HORA_MS).find((r) => r > t);
    if (ranura !== undefined) return new Date(ranura);
    medianoche += DIA_MS;
  }
}

/** La hora de Colombia de un instante como la guarda config_ia («19:00»), o null si no es una de la lista. */
export function horaDeRanura(instante: Date): HoraResumen | null {
  const texto = new Date(instante.getTime() - DESFASE_COT_MS).toISOString().slice(11, 16);
  return HORAS_RESUMEN.find((h) => h === texto) ?? null;
}
