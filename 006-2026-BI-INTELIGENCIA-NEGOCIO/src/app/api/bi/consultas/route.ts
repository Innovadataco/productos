import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";

// Historial del chat (observabilidad, SPEC-006): Prisma en runtime Node,
// siempre dinámico — nada de esto corre en edge ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tope fijo del historial del chat (últimas N consultas del usuario). */
const HISTORIAL_MAX = 50;

/**
 * GET /api/bi/consultas — MI historial de consultas al motor (más reciente
 * primero). Defensa en profundidad tras el middleware (fail-closed, SE2).
 *
 * Devuelve SOLO lo que el chat necesita para repoblar la conversación:
 * id, preguntaNL, respuestaTexto, estado, creadoEn, latenciaMs.
 * NUNCA sql ni planJson ni pasos — el detalle completo se pide por id.
 */
export async function GET() {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    const consultas = await prisma.bIConsultaLog.findMany({
        where: { usuarioId: sesion.email },
        orderBy: { creadoEn: "desc" },
        take: HISTORIAL_MAX,
        select: {
            id: true,
            preguntaNL: true,
            respuestaTexto: true,
            estado: true,
            creadoEn: true,
            latenciaMs: true,
        },
    });

    return NextResponse.json({ consultas }, { status: 200 });
}
