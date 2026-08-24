/**
 * SPEC-226 (002-PI-mega-cola, FR-006): handler `asignar_operador` — derivación
 * a humano sobre `Recomendacion` (dominio de negocio; NO reutiliza
 * `asignarOperadorAReporte`, que opera sobre `Reporte` en moderación).
 *
 * La asignación se persiste en `EjecucionAccion.resultado.operadorId` y se
 * notifica al operador vía Motor Notif (evento `analisis.operador.asignacion`).
 * Estrategia `menor_carga`: operador activo con menos ejecuciones
 * ASIGNAR_OPERADOR vivas (recomendación aún PENDIENTE); empate → el de
 * asignación más antigua; desempate final → alta más antigua.
 *
 * Rollback: la recomendación vuelve a PENDIENTE y se notifica la desasignación.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { programar } from "@/lib/notificaciones";
import { asignarOperadorSchema } from "../schemas";
import type { AccionHandler, AccionHandlerContext } from "../types";

export const EVENTO_OPERADOR_ASIGNACION = "analisis.operador.asignacion";

function urlPanel(): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return `${appUrl}/dashboard/admin/analisis/recomendaciones`;
}

/** Selección `menor_carga` pura (testeable sin BD). */
export function seleccionarOperadorMenorCarga(
    operadores: { id: string; creadoEn: Date }[],
    asignaciones: { operadorId: string; ejecutadaEn: Date }[]
): string | null {
    if (operadores.length === 0) return null;
    const carga = new Map<string, number>();
    const ultima = new Map<string, number>();
    for (const a of asignaciones) {
        carga.set(a.operadorId, (carga.get(a.operadorId) ?? 0) + 1);
        const ts = a.ejecutadaEn.getTime();
        if (ts > (ultima.get(a.operadorId) ?? 0)) ultima.set(a.operadorId, ts);
    }
    const ordenados = [...operadores].sort((a, b) => {
        const ca = carga.get(a.id) ?? 0;
        const cb = carga.get(b.id) ?? 0;
        if (ca !== cb) return ca - cb;
        const ua = ultima.get(a.id) ?? 0;
        const ub = ultima.get(b.id) ?? 0;
        if (ua !== ub) return ua - ub;
        return a.creadoEn.getTime() - b.creadoEn.getTime();
    });
    return ordenados[0]?.id ?? null;
}

async function resolverOperador(ctx: AccionHandlerContext): Promise<{ operadorId: string; estrategia: string }> {
    const parsed = asignarOperadorSchema.safeParse(ctx.parametros);
    if (!parsed.success) {
        const detalle = parsed.error.issues[0]?.message ?? "esquema inválido";
        throw new AppError(`parametros_invalidos: ${detalle}`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const params = parsed.data;

    if (params.operadorId) {
        const operador = await ctx.repo.obtenerOperadorActivo(params.operadorId);
        if (!operador) {
            throw new AppError("operador_no_valido", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        return { operadorId: operador.id, estrategia: "explicito" };
    }

    const operadores = await ctx.repo.listarOperadoresActivosIds();
    if (operadores.length === 0) {
        throw new AppError("sin_operadores_disponibles", ERROR_CODES.CONFLICT, 409);
    }
    const vivas = await ctx.repo.listarAsignacionesVivas();
    const asignaciones = vivas.flatMap((v) => {
        const resultado = v.resultado;
        if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return [];
        const operadorId = (resultado as Record<string, unknown>)["operadorId"];
        return typeof operadorId === "string" ? [{ operadorId, ejecutadaEn: v.ejecutadaEn }] : [];
    });
    const seleccionado = seleccionarOperadorMenorCarga(operadores, asignaciones);
    if (!seleccionado) {
        throw new AppError("sin_operadores_disponibles", ERROR_CODES.CONFLICT, 409);
    }
    return { operadorId: seleccionado, estrategia: "menor_carga" };
}

export const asignarOperadorHandler: AccionHandler = {
    clave: "asignar_operador",
    tipo: "ASIGNAR_OPERADOR",

    async ejecutar(ctx) {
        const { operadorId, estrategia } = await resolverOperador(ctx);
        const { recomendacion } = ctx;
        return {
            resultado: { operadorId, estrategia },
            notificar: async () => {
                const r = await programar({
                    evento: EVENTO_OPERADOR_ASIGNACION,
                    sujetoTipo: "Recomendacion",
                    sujetoId: recomendacion.id,
                    destinatarios: [
                        {
                            usuarioId: operadorId,
                            variables: {
                                tituloRecomendacion: recomendacion.titulo,
                                descripcionRecomendacion: recomendacion.descripcion,
                                urlPanel: urlPanel(),
                            },
                        },
                    ],
                });
                return { notificacionOperador: { programadas: r.programadas } };
            },
        };
    },

    async revertir(ctx) {
        const resultado = (ctx.ejecucion.resultado ?? {}) as Record<string, unknown>;
        const operadorId = typeof resultado["operadorId"] === "string" ? resultado["operadorId"] : null;
        // La recomendación vuelve a PENDIENTE sin operador (dentro de la TX).
        await ctx.repo.devolverRecomendacionAPendiente(ctx.recomendacion.id);
        return {
            detalle: "operador desasignado; recomendación devuelta a PENDIENTE",
            resultadoPatch: { revertido: { operadorDesasignadoId: operadorId } },
            notificar: operadorId
                ? async () => {
                    await programar({
                        evento: EVENTO_OPERADOR_ASIGNACION,
                        sujetoTipo: "Recomendacion",
                        sujetoId: ctx.recomendacion.id,
                        destinatarios: [
                            {
                                usuarioId: operadorId,
                                variables: {
                                    tituloRecomendacion: `DESASIGNADO: ${ctx.recomendacion.titulo}`,
                                    descripcionRecomendacion:
                                          "La asignación automática de este caso fue revertida por un administrador.",
                                    urlPanel: urlPanel(),
                                },
                            },
                        ],
                    });
                }
                : undefined,
        };
    },
};
