/**
 * SPEC-226 (002-PI-mega-cola, FR-004): handler `enviar_notificacion`.
 *
 * Candado del módulo: SOLO se llama `programar()`/`cancelar()` del Motor
 * Notificaciones (API pública); PROHIBIDO escribir en `Notificacion`
 * directamente. Las llamadas al motor quedan FUERA de la TX (fail-open hacia
 * notificaciones, nunca hacia la acción): `ejecutar` resuelve el destinatario
 * dentro de la TX y devuelve el `notificar` que el ejecutor corre post-TX.
 *
 * `programadas = 0` (evento sin reglas activas en el motor) NO es fallo: el
 * motor ya loguea el warning y la ejecución queda EJECUTADA con cero envíos.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { cancelar, programar } from "@/lib/notificaciones";
import { enviarNotificacionSchema, type EnviarNotificacionParams } from "../schemas";
import type { AccionHandler } from "../types";

async function resolverDestinatarioUsuarioId(ctx: Parameters<AccionHandler["ejecutar"]>[0]): Promise<string> {
    const { recomendacion, repo } = ctx;
    if (recomendacion.sujetoTipo === "Usuario" && recomendacion.sujetoId) {
        return recomendacion.sujetoId;
    }
    if (recomendacion.sujetoTipo === "Suscripcion" && recomendacion.sujetoId) {
        const suscripcion = await repo.obtenerSuscripcionParaAccion(recomendacion.sujetoId);
        if (!suscripcion || suscripcion.estado === "CANCELADA") {
            throw new AppError("sujeto_no_valido", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (suscripcion.usuarioId) return suscripcion.usuarioId;
    }
    throw new AppError("destinatario_no_resoluble", ERROR_CODES.VALIDATION_ERROR, 400);
}

function leerEventoDeParametros(parametros: unknown): string | null {
    if (!parametros || typeof parametros !== "object" || Array.isArray(parametros)) return null;
    const evento = (parametros as Record<string, unknown>)["evento"];
    return typeof evento === "string" && evento.length > 0 ? evento : null;
}

export const enviarNotificacionHandler: AccionHandler = {
    clave: "enviar_notificacion",
    tipo: "ENVIAR_NOTIFICACION",

    async ejecutar(ctx) {
        const parsed = enviarNotificacionSchema.safeParse(ctx.parametros);
        if (!parsed.success) {
            const detalle = parsed.error.issues[0]?.message ?? "esquema inválido";
            throw new AppError(`parametros_invalidos: ${detalle}`, ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const params: EnviarNotificacionParams = parsed.data;
        const destinatarioUsuarioId = await resolverDestinatarioUsuarioId(ctx);
        const { sujetoTipo, sujetoId } = ctx.recomendacion;

        return {
            resultado: { evento: params.evento, destinatarioUsuarioId },
            notificar: async () => {
                const r = await programar({
                    evento: params.evento,
                    sujetoTipo: sujetoTipo ?? undefined,
                    sujetoId: sujetoId ?? undefined,
                    destinatarios: [{ usuarioId: destinatarioUsuarioId, variables: params.variables ?? {} }],
                });
                if (r.programadas === 0) {
                    console.warn(
                        `[Analisis/Acciones] enviar_notificacion: evento=${params.evento} programó 0 envíos (sin reglas activas o sin plantilla)`
                    );
                }
                return { programadas: r.programadas, canceladasPorReemplazo: r.canceladasPorReemplazo };
            },
        };
    },

    async revertir(ctx) {
        const evento = leerEventoDeParametros(ctx.ejecucion.parametros);
        const { sujetoTipo, sujetoId } = ctx.recomendacion;
        const resultado = (ctx.ejecucion.resultado ?? {}) as Record<string, unknown>;
        const destinatarioUsuarioId =
            typeof resultado["destinatarioUsuarioId"] === "string" ? resultado["destinatarioUsuarioId"] : undefined;
        if (!evento) {
            return { detalle: "sin evento asociado a la ejecución" };
        }
        return {
            detalle: "cancelando programaciones futuras del evento",
            notificar: async () => {
                // cancelar() solo toca programaciones futuras; si ya se envió,
                // la reversión queda registrada como "no reversible (ya enviada)".
                const r = await cancelar({
                    evento,
                    sujetoTipo: sujetoTipo ?? undefined,
                    sujetoId: sujetoId ?? undefined,
                    destinatarioUsuarioId,
                    soloProgramadas: true,
                });
                return {
                    detalle: r.canceladas > 0 ? "notificaciones futuras canceladas" : "no reversible (ya enviada)",
                    resultadoPatch: { revertido: { canceladas: r.canceladas } },
                };
            },
        };
    },
};
