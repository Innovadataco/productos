/**
 * El informe para operar (frente operar-informe, hito O1 de la fase E): determinista, sin base, sin red, sin reloj y
 * sin IA. Junta lo que ya calculan otras piezas, sin cambiarlas:
 * - el estado del portafolio, del tablero (`calcularTablero`);
 * - sus reglas hoy, con `estadoDelNivel` y el último cierre de cada especie;
 * - las fechas de los próximos días: ex-dividendos (`proximos`) y plazos de las reglas;
 * - si la carga de precios se detuvo (`preciosAtrasados`).
 * Muestra lo que el dueño escribió en su plan; la decisión es suya.
 */
import { esFechaDeNegocio, sumarDias } from "@/plan/fechas";
import { preciosAtrasados } from "@/plan/cierre-frescura";
import { estadoDelPortafolio } from "./estado";
import { DIAS_FECHAS, fechasQueImportan } from "./fechas";
import { reglasDeHoy } from "./reglas";
import type { EntradasInforme, Informe } from "./tipos";

export { DIAS_FECHAS } from "./fechas";
export { UMBRAL_CERCANA_PCT } from "./reglas";

export function armarInforme(entradas: EntradasInforme, hoy: Date): Informe {
  if (!esFechaDeNegocio(hoy)) throw new RangeError("hoy debe ser una fecha de negocio (medianoche UTC).");
  const referencia = entradas.tablero.fechaReferencia;
  const hasta = sumarDias(hoy, DIAS_FECHAS);
  const reglas = reglasDeHoy(entradas.plan, entradas.cierresDeReglas, referencia, hoy);
  return {
    hoy,
    hasta,
    referencia,
    preciosAtrasados: preciosAtrasados(referencia, hoy, entradas.calendario),
    estado: estadoDelPortafolio(entradas.tablero, entradas.incompletas),
    reglas,
    fechas: fechasQueImportan(entradas.proximos, [...reglas.seCumplen, ...reglas.cercanas, ...reglas.resto], hoy, hasta),
  };
}
