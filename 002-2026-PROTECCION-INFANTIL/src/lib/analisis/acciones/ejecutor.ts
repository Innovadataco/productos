/**
 * SPEC-226 (002-PI-mega-cola, FR-001/FR-008/FR-009/FR-013/FR-015): ejecutor de
 * acciones automáticas de las reglas en modo EJECUTA.
 *
 * Flujo (plan §3.1):
 *   1. Carga recomendación + regla.
 *   2. Precondiciones: modo EJECUTA (si el origen es AUTOMATICA) y estado
 *      PENDIENTE; luego rate-limit por regla (scope `analisis_accion`,
 *      identifier = reglaId) y resolución del handler por clave.
 *      Cualquier rechazo queda como `EjecucionAccion(FALLIDA)` + AuditLog
 *      (`ANALISIS_ACCION_FALLIDA`), sin efectos colaterales.
 *   3. TX: bloqueo de fila de la recomendación → `handler.ejecutar` →
 *      `EjecucionAccion(EJECUTADA)` → recomendación APLICADA →
 *      `AuditLog(ANALISIS_ACCION_EJECUTADA)`. Un throw revierte TODO y se
 *      registra FALLIDA con el mensaje seguro del error.
 *   4. Post-TX: `notificar()` del handler (Motor Notif) fail-open con log; su
 *      patch se fusiona en `resultado`.
 *
 * NUNCA lanza: devuelve la `EjecucionAccion` (EJECUTADA o FALLIDA). Un fallo
 * de una recomendación no detiene las demás del tick del worker (SC-004).
 * Los metadatos de auditoría llevan la regla origen y nunca PII ni textos de
 * reportes.
 */
import { Prisma, type EjecucionAccion, type OrigenEjecucion, type TipoAccionEjecutable } from "@prisma/client";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { EjecucionAccionRepository } from "@/lib/dal/repositories/ejecucion-accion";
import { obtenerHandlerPorClave } from "./registry";
import { verificarRateLimitRegla } from "./rate-limit-regla";
import type { AccionHandler, HandlerResult } from "./types";

export interface EjecutarAccionInput {
    recomendacionId: string;
    origen: OrigenEjecucion;
    /** Requerido si origen = MANUAL_ADMIN. */
    adminId?: string | undefined;
}

/**
 * `EjecucionAccion.tipoAccion` es NOT NULL (data-model §3.4). Cuando la clave
 * es desconocida no hay tipo real: se persiste un placeholder y el motivo real
 * queda en `motivoFallo` (`accion_desconocida: <clave>`).
 */
const TIPO_PLACEHOLDER_DESCONOCIDO: TipoAccionEjecutable = "CREAR_ALERTA";

function snapshotParametros(valor: unknown): Prisma.InputJsonValue {
    if (valor === null || valor === undefined) return {};
    return valor as Prisma.InputJsonValue;
}

export async function ejecutarAccion(input: EjecutarAccionInput): Promise<EjecucionAccion> {
    const repo = new EjecucionAccionRepository();
    const origen: OrigenEjecucion = input.origen;

    const recomendacion = await repo.obtenerRecomendacionConRegla(input.recomendacionId);
    if (!recomendacion) {
        throw new AppError("Recomendación no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    const regla = recomendacion.regla;
    const clave = regla.accionEjecutable ?? recomendacion.accionSugerida;
    const handler = obtenerHandlerPorClave(clave);
    const tipoAccion: TipoAccionEjecutable = handler?.tipo ?? TIPO_PLACEHOLDER_DESCONOCIDO;
    const parametros = snapshotParametros(recomendacion.accionParametros ?? regla.accionParametros);

    const registrarFallo = async (motivo: string): Promise<EjecucionAccion> => {
        const fallida = await repo.crearEjecucion({
            recomendacionId: recomendacion.id,
            reglaId: regla.id,
            tipoAccion,
            parametros,
            estado: "FALLIDA",
            motivoFallo: motivo,
            origenEjecucion: origen,
            ejecutadaPorAdminId: input.adminId ?? null,
        });
        await logAudit({
            accion: "ANALISIS_ACCION_FALLIDA",
            tipoRecurso: "EjecucionAccion",
            recursoId: fallida.id,
            usuarioId: input.adminId,
            metadatos: {
                reglaId: regla.id,
                reglaClave: regla.clave,
                recomendacionId: recomendacion.id,
                tipoAccion,
                origenEjecucion: origen,
                motivo,
            },
        });
        console.warn(
            `[Analisis/Acciones] Ejecución FALLIDA regla=${regla.clave} recomendacion=${recomendacion.id}: ${motivo}`
        );
        return fallida;
    };

    // Precondiciones (cada rechazo queda trazado, sin efectos colaterales).
    if (origen === "AUTOMATICA" && regla.modo !== "EJECUTA") {
        return registrarFallo("modo_no_ejecuta");
    }
    if (recomendacion.estado !== "PENDIENTE") {
        return registrarFallo("recomendacion_no_pendiente");
    }
    if (!handler) {
        return registrarFallo(`accion_desconocida: ${clave ?? "(nula)"}`);
    }

    const rate = await verificarRateLimitRegla(regla.id);
    if (!rate.allowed) {
        return registrarFallo("rate_limit_regla");
    }

    let salida: { ejecucion: EjecucionAccion; notificar: HandlerResult["notificar"] };
    try {
        salida = await repo.ejecutarEnTransaccion(async (tx) => {
            const txRepo = new EjecucionAccionRepository(tx);
            // Bloqueo de fila: doble ejecución concurrente (edge case de la spec).
            const bloqueo = await txRepo.bloquearRecomendacion(recomendacion.id);
            if (!bloqueo || bloqueo.estado !== "PENDIENTE") {
                throw new AppError("recomendacion_no_pendiente", ERROR_CODES.CONFLICT, 409);
            }

            const resultado = await handler.ejecutar({
                recomendacion,
                regla,
                parametros: recomendacion.accionParametros ?? regla.accionParametros,
                tx,
                repo: txRepo,
            });

            const ejecucion = await txRepo.crearEjecucion({
                recomendacionId: recomendacion.id,
                reglaId: regla.id,
                tipoAccion,
                parametros,
                estado: "EJECUTADA",
                resultado: resultado.resultado as Prisma.InputJsonValue,
                origenEjecucion: origen,
                ejecutadaPorAdminId: input.adminId ?? null,
            });

            await txRepo.marcarRecomendacionAplicada(recomendacion.id, {
                ejecutadaAutomatica: origen === "AUTOMATICA",
                resueltaPorAdminId: input.adminId ?? null,
                motivoResolucion: origen === "AUTOMATICA" ? "EJECUCION_AUTOMATICA" : "APLICACION_MANUAL",
            });

            await logAudit({
                accion: "ANALISIS_ACCION_EJECUTADA",
                tipoRecurso: "EjecucionAccion",
                recursoId: ejecucion.id,
                usuarioId: input.adminId,
                metadatos: {
                    reglaId: regla.id,
                    reglaClave: regla.clave,
                    recomendacionId: recomendacion.id,
                    tipoAccion,
                    origenEjecucion: origen,
                    resultado: resultado.resultado,
                },
                tx,
            });

            return { ejecucion, notificar: resultado.notificar };
        });
    } catch (error) {
        // La TX se revirtió: ni la acción ni la trazabilidad parcial quedaron.
        const motivo = safeErrorMessage(error, { fallback: "error_interno_accion" });
        return registrarFallo(motivo);
    }

    // Post-TX: Motor Notif fail-open (nunca revierte la acción ya persistida).
    let ejecucionFinal = salida.ejecucion;
    if (salida.notificar) {
        try {
            const patch = await salida.notificar();
            if (patch && Object.keys(patch).length > 0) {
                ejecucionFinal = await repo.fusionarResultado(ejecucionFinal.id, patch);
            }
        } catch (error) {
            console.error(
                `[Analisis/Acciones] Error en notificar() post-TX (ejecución ${ejecucionFinal.id} queda EJECUTADA):`,
                error instanceof Error ? error.message : error
            );
        }
    }
    return ejecucionFinal;
}
