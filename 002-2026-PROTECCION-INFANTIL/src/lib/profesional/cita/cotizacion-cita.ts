/**
 * SPEC-934 (I-450) · La cotización de una cita nueva: UNA fuente para lo que el padre VE y lo que se GUARDA.
 *
 * El defecto: la ficha y el modal mostraban solo el precio de la consulta ($50.000) mientras
 * `crearSolicitudCita` guardaba `montoTotal` = consulta + servicio de la red ($55.000). D-103(c) (Jelkin,
 * 03-09): «el profesional fija su tarifa; PI le cobra al padre esa tarifa MÁS un porcentaje configurable».
 *
 * `cotizarCitaNueva` lee los MISMOS dos parámetros que usa la ruta de creación (precio estándar de la
 * primera cita, SPEC-428, y `comision.porcentaje`, SPEC-403) y los pasa por `desglosarTarifa` — la misma
 * función que usa `crearSolicitudCita` para calcular lo que guarda. La pantalla la consume para pintar el
 * desglose; la ruta POST la consume para crear Y para rechazar si el total que el padre aceptó ya no es el
 * vigente (el admin cambió la comisión entre que vio y confirmó).
 */
import type { ParametroClient } from "@/lib/parametros";
import { desglosarTarifa, obtenerPorcentajeServicio, type DesgloseTarifa } from "./comision";
import { leerPrecioEstandarPrimeraCita } from "./precio-primera-cita";

export type CotizacionCita = DesgloseTarifa;

/** Mensaje al padre (voz tú) cuando el total cambió entre ver y confirmar (409 de `POST /api/padre/citas`). */
export const MENSAJE_TOTAL_CAMBIO =
    "El valor de la cita cambió mientras la estabas pidiendo. Revisa el nuevo total y vuelve a confirmar.";

export async function cotizarCitaNueva(client?: ParametroClient): Promise<CotizacionCita> {
    const [precioConsulta, porcentaje] = await Promise.all([
        leerPrecioEstandarPrimeraCita(client),
        obtenerPorcentajeServicio(client),
    ]);
    return desglosarTarifa(precioConsulta, porcentaje);
}
