/**
 * SPEC-226 (002-PI-mega-cola, FR-002): registro de handlers por tipo de
 * acción ejecutable. Mapea la clave criolla de `ReglaRecomendacion.accionEjecutable`
 * (brief §9) al handler; el enum `TipoAccionEjecutable` es la representación
 * persistida en `EjecucionAccion.tipoAccion`.
 *
 * Clave desconocida → `null`: el ejecutor registra `EjecucionAccion(FALLIDA)`
 * con motivo `accion_desconocida` y la recomendación queda disponible para
 * revisión humana.
 */
import type { TipoAccionEjecutable } from "@prisma/client";
import type { AccionHandler } from "./types";
import { crearBonoHandler } from "./handlers/crear-bono";
import { enviarNotificacionHandler } from "./handlers/enviar-notificacion";
import { asignarOperadorHandler } from "./handlers/asignar-operador";
import { crearAlertaHandler } from "./handlers/crear-alerta";

const HANDLERS: readonly AccionHandler[] = [
    crearBonoHandler,
    enviarNotificacionHandler,
    asignarOperadorHandler,
    crearAlertaHandler,
];

const POR_CLAVE = new Map<string, AccionHandler>(HANDLERS.map((h) => [h.clave, h]));

export function obtenerHandlerPorClave(clave: string | null | undefined): AccionHandler | null {
    if (!clave) return null;
    return POR_CLAVE.get(clave) ?? null;
}

export function obtenerHandlerPorTipo(tipo: TipoAccionEjecutable): AccionHandler | null {
    return HANDLERS.find((h) => h.tipo === tipo) ?? null;
}
