/**
 * SPEC-341 (T032) · GET/POST /api/padre/expedientes/[id]/analisis.
 *
 * GET:  el UI llama al abrir el expediente. Devuelve el vigente + estado
 *       de la cadena + de la cola + cool-down. Efecto lateral: puede
 *       ENCOLAR un job de análisis si la cadena cambió (idempotente vía
 *       `singletonKey` de pg-boss).
 * POST: pulsar "Actualizar análisis". Honora cool-down; si el hash no
 *       cambió, responde "ya al día" y reinicia el cool-down.
 *
 * Boundary: PARENT dueña del expediente — 403 para otros roles y 404 para
 * expedientes ajenos (garantía FR-017).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
    evaluarYEncolarSiCorresponde,
} from "@/lib/dal/services/analisis-expediente";

async function guardPadre(): Promise<{ id: string; email: string; rol: string }> {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

function serializar(evaluacion: Awaited<ReturnType<typeof evaluarYEncolarSiCorresponde>>) {
    const { vigente, hashActual, coincide, hechosNuevosDesde, estado, cola, colaLlena, cooldown } = evaluacion;
    return {
        vigente: vigente
            ? {
                versionSecuencial: vigente.versionSecuencial,
                texto: vigente.texto,
                corteN: vigente.corteN,
                categoriaDominante: vigente.categoriaDominante,
                generadoEn: vigente.generadoEn.toISOString(),
                guiaAccion: vigente.guiaAccion
                    ? {
                        id: vigente.guiaAccion.id,
                        tituloEmocional: vigente.guiaAccion.tituloEmocional,
                        pasos: vigente.guiaAccion.pasosJson,
                    }
                    : null,
            }
            : null,
        hashActual,
        coincide,
        hechosNuevosDesde,
        estado,
        cola,
        colaLlena,
        cooldown,
    };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardPadre();
        const { id } = await params;
        const evaluacion = await evaluarYEncolarSiCorresponde(id, user.id, "APERTURA");
        return NextResponse.json(serializar(evaluacion), { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ANALISIS·GET] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardPadre();
        const { id } = await params;
        const evaluacion = await evaluarYEncolarSiCorresponde(id, user.id, "ACTUALIZAR");

        // Cool-down: la evaluación NO chequea (siempre calcula la ventana); acá el POST
        // devuelve el motivo del rechazo si cool-down aún corre.
        if (evaluacion.vigente && !evaluacion.cooldown.puedeActualizar) {
            return NextResponse.json({
                encolado: false,
                motivo: "cooldown",
                faltanSeg: evaluacion.cooldown.faltanSeg,
            }, { status: 200 });
        }

        if (evaluacion.colaLlena) {
            return NextResponse.json({
                encolado: false,
                motivo: "cola_llena",
            }, { status: 200 });
        }

        if (evaluacion.estado === "GENERANDO") {
            return NextResponse.json({
                encolado: true,
                estado: "GENERANDO",
                cola: evaluacion.cola,
            }, { status: 200 });
        }

        // No se encoló → cadena sin cambios; reiniciamos el cool-down "conceptual"
        // dejándolo al valor total (el UI ya lee el nuevo generadoEn del vigente).
        return NextResponse.json({
            encolado: false,
            motivo: "ya_al_dia",
            cooldownReiniciadoSeg: evaluacion.cooldown.faltanSeg,
        }, { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ANALISIS·POST] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
