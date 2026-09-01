import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";

// Siempre dinámico y en runtime Node (Prisma no corre en edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Contrato del chat: como máximo 6 sugerencias por pantalla.
const MAX_SUGERENCIAS = 6;

/**
 * GET /api/bi/ejemplos — preguntas sugeridas del chat. Fuente: SOLO ejemplos
 * del catálogo verificados por humanos (candado 8: el catálogo es dato en BD;
 * candado 7: el SQL de ejemplo lo aprobó un operador, no el LLM).
 * Orden alfabético = orden estable entre recargas.
 *
 * Fail-open con lista vacía: si la BD falla, el chat sigue funcionando, solo
 * sin sugerencias (son guía de uso, no dato operativo). El error va al log.
 */
export async function GET() {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    try {
        const ejemplos = await prisma.bICatalogoEjemplo.findMany({
            where: { verificado: true },
            select: { preguntaNL: true },
            orderBy: { preguntaNL: "asc" },
            take: MAX_SUGERENCIAS,
        });
        return NextResponse.json({ sugerencias: ejemplos.map((e) => e.preguntaNL) });
    } catch (error) {
        console.error("[BI] /api/bi/ejemplos: error leyendo el catálogo de ejemplos", error);
        return NextResponse.json({ sugerencias: [] });
    }
}
