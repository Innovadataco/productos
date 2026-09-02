import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";

// Detalle de UNA consulta mía (auditoría "Ver traza" + polling de las que
// quedaron pendientes). Prisma en runtime Node, siempre dinámico.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parsea un String? JSON de la bitácora; null ante vacío o JSON roto. */
function parsearJson(campo: string | null): unknown {
    if (!campo) return null;
    try {
        return JSON.parse(campo) as unknown;
    } catch {
        return null;
    }
}

/**
 * GET /api/bi/consultas/[id] — detalle COMPLETO de una consulta de la
 * bitácora: pregunta, respuesta, sql, plan y pasos parseados, estado,
 * latencia. Defensa tenancy: si la consulta no es MÍA, 403 (no 404 — el
 * id es un cuid no adivinable; el 403 no filtra existencia a terceros
 * porque exige sesión válida primero).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const consulta = await prisma.bIConsultaLog.findUnique({ where: { id } });
    if (!consulta) {
        return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
    }
    if (consulta.usuarioId !== sesion.email) {
        return NextResponse.json({ error: "prohibido" }, { status: 403 });
    }

    return NextResponse.json(
        {
            id: consulta.id,
            preguntaNL: consulta.preguntaNL,
            respuestaTexto: consulta.respuestaTexto,
            sqlGenerado: consulta.sqlGenerado,
            plan: parsearJson(consulta.planJson),
            pasos: parsearJson(consulta.pasosJson),
            estado: consulta.estado,
            latenciaMs: consulta.latenciaMs,
            fuenteCache: consulta.fuenteCache,
            error: consulta.error,
            creadoEn: consulta.creadoEn,
        },
        { status: 200 },
    );
}
