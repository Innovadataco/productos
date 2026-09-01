/**
 * SPEC-350 (A-69 · C3 · T031) · GET/POST /api/colegio/casos/[id]/analisis.
 *
 * Misma forma de respuesta que la ruta del padre (SPEC-341/348) más los datos
 * de pantalla del caso (hechos visibles + curso + estado). Boundary:
 * SCHOOL_ADMIN o COMITE_CONVIVENCIA del MISMO colegio del caso.
 *
 * GET: al abrir el detalle — puede encolar (idempotente por singletonKey).
 * POST: botón "Actualizar análisis" — cool-down primero, y es la vía de
 * escape cuando el vigente es FALLIDO (SPEC-348 aplicada al caso).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { evaluarYEncolarCaso, cooldownDeCaso } from "@/lib/dal/services/analisis-caso";

async function guardColegio() {
    const user = await verifyAuth();
    if (user.rol !== "SCHOOL_ADMIN" && user.rol !== "COMITE_CONVIVENCIA") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

function serializar(ev: Awaited<ReturnType<typeof evaluarYEncolarCaso>>) {
    return {
        vigente: ev.vigente
            ? {
                versionSecuencial: ev.vigente.versionSecuencial,
                texto: ev.vigente.texto,
                corteN: ev.vigente.corteN,
                categoriaDominante: ev.vigente.categoriaDominante,
                generadoEn: ev.vigente.generadoEn.toISOString(),
                guiaAccion: ev.vigente.guiaAccion
                    ? {
                        id: ev.vigente.guiaAccion.id,
                        tituloEmocional: ev.vigente.guiaAccion.tituloEmocional,
                        pasos: ev.vigente.guiaAccion.pasosJson,
                    }
                    : null,
            }
            : null,
        hashActual: ev.hashActual,
        coincide: ev.coincide,
        hechosNuevosDesde: ev.hechosNuevosDesde,
        estado: ev.estado,
        cola: ev.cola,
        colaLlena: ev.colaLlena,
        cooldown: ev.cooldown,
        agotadoPorFallos: ev.agotadoPorFallos,
        ultimoMotivoFallo: ev.ultimoMotivoFallo,
        caso: ev.caso,
        hechos: ev.hechos.map((h) => ({ ...h, fecha: h.fecha.toISOString() })),
    };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardColegio();
        const { id } = await params;
        const ev = await evaluarYEncolarCaso(id, user, "APERTURA");
        return NextResponse.json(serializar(ev), { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ANALISIS·CASO·GET] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardColegio();
        const { id } = await params;

        // Cool-down PRIMERO, sin tocar la cola (patrón SPEC-348 nº5).
        const previo = await cooldownDeCaso(id, user);
        if (previo.vigente && !previo.cooldown.puedeActualizar) {
            return NextResponse.json({
                encolado: false,
                motivo: "cooldown",
                faltanSeg: previo.cooldown.faltanSeg,
            }, { status: 200 });
        }

        const ev = await evaluarYEncolarCaso(id, user, "ACTUALIZAR");

        if (ev.colaLlena) {
            return NextResponse.json({ encolado: false, motivo: "cola_llena" }, { status: 200 });
        }
        if (ev.estado === "GENERANDO") {
            return NextResponse.json({ encolado: true, estado: "GENERANDO", cola: ev.cola }, { status: 200 });
        }
        // "ya_al_dia" SOLO con vigente PUBLICADO coincidente (SPEC-348).
        if (ev.vigente && ev.coincide) {
            return NextResponse.json({ encolado: false, motivo: "ya_al_dia" }, { status: 200 });
        }
        return NextResponse.json({ encolado: false, motivo: "sin_hechos" }, { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ANALISIS·CASO·POST] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
