/**
 * SPEC-226 (002-PI-mega-cola, FR-005): handler `crear_alerta` — alerta al
 * admin vía Motor Notif (evento `analisis.alerta.admin`, solo `programar()`).
 *
 * Destinatarios: la lista de usuarioIds admin de
 * `analisis.acciones.alertas_destinatarios`; si está vacía o es inválida,
 * todos los ADMIN activos. Severidad ALTA → envío inmediato (offset +0m de la
 * regla sembrada); MEDIA/BAJA quedan a criterio de las reglas del motor (que
 * pueden agruparlas en el digest, SPEC-223).
 *
 * Rollback: marca la alerta como atendida (registro); las alertas ya enviadas
 * no se des-envían.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import { programar } from "@/lib/notificaciones";
import { crearAlertaSchema } from "../schemas";
import type { AccionHandler } from "../types";

export const EVENTO_ALERTA_ADMIN = "analisis.alerta.admin";
export const PARAM_ALERTAS_DESTINATARIOS = "analisis.acciones.alertas_destinatarios";

/**
 * Resolución pura de destinatarios (testeable sin BD): si el parámetro es un
 * JSON válido con una lista no vacía de strings, manda la lista; en cualquier
 * otro caso, todos los ADMIN activos.
 */
export function resolverDestinatariosAlerta(paramValorRaw: string | null, adminsActivosIds: string[]): string[] {
    if (paramValorRaw) {
        try {
            const parsed: unknown = JSON.parse(paramValorRaw);
            if (
                Array.isArray(parsed) &&
                parsed.length > 0 &&
                parsed.every((v) => typeof v === "string" && v.length > 0)
            ) {
                return parsed as string[];
            }
        } catch {
            // JSON inválido: cae al default (todos los ADMIN activos).
        }
    }
    return adminsActivosIds;
}

export const crearAlertaHandler: AccionHandler = {
    clave: "crear_alerta",
    tipo: "CREAR_ALERTA",

    async ejecutar(ctx) {
        const parsed = crearAlertaSchema.safeParse(ctx.parametros);
        if (!parsed.success) {
            const detalle = parsed.error.issues[0]?.message ?? "esquema inválido";
            throw new AppError(`parametros_invalidos: ${detalle}`, ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const params = parsed.data;

        const paramRaw = await getParametroSistemaValor(PARAM_ALERTAS_DESTINATARIOS, ctx.tx);
        const adminsActivos = await ctx.repo.listarAdminsActivosIds();
        const destinatarios = resolverDestinatariosAlerta(
            paramRaw,
            adminsActivos.map((a) => a.id)
        );
        if (destinatarios.length === 0) {
            throw new AppError("sin_destinatarios_alerta", ERROR_CODES.CONFLICT, 409);
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const variables: Record<string, unknown> = {
            severidad: params.severidad,
            mensaje: params.mensaje,
            reglaClave: ctx.regla.clave,
            urlPanel: `${appUrl}/dashboard/admin/analisis/recomendaciones`,
            ...(params.datosContexto ?? {}),
        };

        return {
            resultado: { severidad: params.severidad, destinatarios: destinatarios.length },
            notificar: async () => {
                const r = await programar({
                    evento: EVENTO_ALERTA_ADMIN,
                    sujetoTipo: "Recomendacion",
                    sujetoId: ctx.recomendacion.id,
                    destinatarios: destinatarios.map((usuarioId) => ({ usuarioId, variables })),
                });
                return { programadas: r.programadas };
            },
        };
    },

    async revertir() {
        // Las alertas ya enviadas no se des-envían: la reversión es un registro.
        return {
            detalle: "alerta marcada como atendida (registro); las alertas ya enviadas no se des-envían",
            resultadoPatch: { revertido: { atendida: true } },
        };
    },
};
