/**
 * DATO_VIEJO (puro; el reloj entra por `ahora`).
 * - Intradía activo: solo en la rueda de un día hábil. El dato es viejo cuando pasa el umbral (30 min) más el retraso de
 *   Yahoo (20 min). La edad se cuenta desde la última barra o desde la apertura, lo que sea más reciente: la barra de ayer no
 *   es vieja a las 9:31. Sin ninguna barra, cuenta desde la apertura.
 * - Falta el cierre: «viejo» = en un día hábil todavía falta el cierre de ese día, desde las 18:00 con el intradía apagado y
 *   desde las 18:15 con el intradía encendido (el cierre llega después de la barra definitiva).
 * - Fuera de la rueda no salta. Los festivos entran como dato (`calendario_bvc`).
 */
import { esDiaHabil, fechaEnBogota } from "../../precios/horario";
import { claveDeAlerta, type Alerta, type PrecioUltimo } from "../tipos";
import type { Umbrales } from "../umbrales";

/** Horario de la rueda de acciones de la BVC en hora de Colombia: por verificar con la circular oficial. */
export const RUEDA_COT = { abre: { hora: 9, minuto: 30 }, cierra: { hora: 16, minuto: 0 } } as const;
/** Retraso con que Yahoo publica las barras. */
export const RETRASO_YAHOO_MIN = 20;
/** Con el intradía apagado, hora desde la que ya debe haber cierre del día. */
export const HORA_CIERRE_ESPERADO_COT = { hora: 18, minuto: 0 } as const;
/** Con el intradía encendido, hora desde la que ya debe haber cierre del día. */
export const HORA_CIERRE_ESPERADO_INTRADIA_COT = { hora: 18, minuto: 15 } as const;

const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const MIN_POR_HORA = 60;
const MS_POR_MIN = 60_000;
const minutosDe = (h: { hora: number; minuto: number }): number => h.hora * MIN_POR_HORA + h.minuto;

export interface EntradaFrescura {
  readonly dia: string;
  readonly ahora: Date;
  readonly instrumentoId: string;
  readonly intradiaActivo: boolean;
  readonly ultimo: PrecioUltimo | null;
  /** Hay un cierre de la especie con la fecha de hoy. */
  readonly cierreDeHoy: boolean;
  readonly noHabiles: ReadonlySet<string>;
}

export function evaluarFrescura(e: EntradaFrescura, umbrales: Umbrales): Alerta | null {
  if (!umbrales.alertaDatoViejoActiva) return null;
  const hoy = fechaEnBogota(e.ahora);
  if (!esDiaHabil(hoy, e.noHabiles)) return null;
  const local = new Date(e.ahora.getTime() - DESFASE_BOGOTA_MS);
  const minutos = local.getUTCHours() * MIN_POR_HORA + local.getUTCMinutes();
  const base = { clave: claveDeAlerta(e.dia, "DATO_VIEJO", e.instrumentoId, null, null), dia: e.dia, tipo: "DATO_VIEJO", instrumentoId: e.instrumentoId, reglaId: null, sentido: null } as const;

  const desde = e.intradiaActivo ? HORA_CIERRE_ESPERADO_INTRADIA_COT : HORA_CIERRE_ESPERADO_COT;
  if (minutos >= minutosDe(desde) && !e.cierreDeHoy) return { ...base, base: "CIERRE", datos: {} };
  if (!e.intradiaActivo) return null;
  if (minutos < minutosDe(RUEDA_COT.abre) || minutos > minutosDe(RUEDA_COT.cierra)) return null;
  const apertura = hoy.getTime() + DESFASE_BOGOTA_MS + minutosDe(RUEDA_COT.abre) * MS_POR_MIN;
  const referencia = Math.max(e.ultimo?.instante.getTime() ?? apertura, apertura);
  const edad = Math.floor((e.ahora.getTime() - referencia) / MS_POR_MIN);
  const umbralMin = umbrales.alertaDatoViejoMin + RETRASO_YAHOO_MIN;
  if (edad <= umbralMin) return null;
  return { ...base, base: "INTRADIA", datos: { minutosDeEdad: edad, umbralMin, instante: e.ultimo?.instante, conRetraso: e.ultimo?.conRetraso } };
}
