/**
 * Los controles del simulador en el borde del servidor (frente proyecciones-pantalla; contrato de
 * src/proyecciones/proyectar.ts): el cuerpo trae EXACTAMENTE los cinco controles; trayectorias y semilla las fija el
 * servidor (el cambio entre dos resultados refleja solo los controles, no ruido del sorteo) y `hoy` nunca viene del
 * cliente. El horizonte de la pantalla va de 1 a 120 meses (el motor admite más). Los demás topes, los del motor.
 * Puro.
 */
import { validarParametros } from "@/proyecciones/parametros";
import type { ErrorParametro, Validacion } from "@/proyecciones/tipos";
import { CAMPOS_CONTROLES, HORIZONTE_MAX_MESES, HORIZONTE_MIN_MESES } from "./opciones";

/** 2.000 trayectorias × 120 meses × 13 posiciones ≈ 65 millones de pasos (≈ 0,14 s en el Mac, escalado de metodo.ts). */
export const TRAYECTORIAS_PANTALLA = 2000;
/** La semilla de la pantalla: la misma en cada pedido, así el mismo escenario da el mismo resultado. */
export const SEMILLA_PANTALLA = 46133;

const esObjeto = (e: unknown): e is Readonly<Record<string, unknown>> => typeof e === "object" && e !== null && !Array.isArray(e);
const RECHAZO: Validacion = { ok: false, errores: [{ campo: "entrada", codigo: "VALOR_NO_PERMITIDO" }] };

export function validarControles(entrada: unknown): Validacion {
  if (!esObjeto(entrada)) return RECHAZO;
  const claves = Object.keys(entrada).sort();
  if (claves.join(",") !== [...CAMPOS_CONTROLES].sort().join(",")) return RECHAZO;
  const v = validarParametros({ ...entrada, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA });
  const h = entrada["horizonteMeses"];
  const fuera: ErrorParametro[] = typeof h === "number" && Number.isInteger(h) && (h < HORIZONTE_MIN_MESES || h > HORIZONTE_MAX_MESES) ? [{ campo: "horizonteMeses", codigo: "FUERA_DE_RANGO" }] : [];
  if (!v.ok) {
    const yaDicho = v.errores.some((e) => e.campo === "horizonteMeses");
    return { ok: false, errores: [...v.errores, ...(yaDicho ? [] : fuera)] };
  }
  return fuera.length > 0 ? { ok: false, errores: fuera } : v;
}
