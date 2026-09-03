import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { leerSesion } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";

// Bitácora global del chat (observabilidad admin, SPEC-006 · Lote 3 · AGENTE C):
// a diferencia de /api/bi/consultas (MI historial, tope 50), acá el admin ve
// TODAS las consultas del motor con filtros de fecha/estado y paginación.
// Prisma en runtime Node, siempre dinámico — nada se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tamaño de página fijo de la bitácora. */
const POR_PAGINA = 25;

/** Estados finales del motor filtrables (el transitorio "pendiente" no se filtra). */
const ESTADOS_FILTRABLES = new Set(["ok", "sin_datos", "clarificacion", "rechazada", "error"]);

/** Valida "YYYY-MM-DD" estricto, incluidas fechas inexistentes (2026-02-30 → inválida). */
function esFechaIso(valor: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

/**
 * GET /api/bi/bitacora?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=…&pagina=N
 * (todo opcional). Defensa en profundidad tras el middleware (fail-closed,
 * SE2). Cualquier filtro presente pero inválido → 400, jamás se ignora en
 * silencio. Devuelve { filas, total, pagina, paginas } con filas ordenadas
 * por creadoEn desc. NUNCA sql/plan/pasos en las filas: la traza completa
 * se pide por id en /api/bi/consultas/[id].
 */
export async function GET(request: Request) {
    const sesion = await leerSesion();
    if (!sesion) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const desde = params.get("desde");
    const hasta = params.get("hasta");
    const estado = params.get("estado");
    const paginaParam = params.get("pagina");

    if (desde !== null && !esFechaIso(desde)) {
        return NextResponse.json({ error: "fecha_invalida", detalle: "desde" }, { status: 400 });
    }
    if (hasta !== null && !esFechaIso(hasta)) {
        return NextResponse.json({ error: "fecha_invalida", detalle: "hasta" }, { status: 400 });
    }
    if (estado !== null && !ESTADOS_FILTRABLES.has(estado)) {
        return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
    }
    let pagina = 1;
    if (paginaParam !== null) {
        pagina = Number(paginaParam);
        if (!Number.isInteger(pagina) || pagina < 1) {
            return NextResponse.json({ error: "pagina_invalida" }, { status: 400 });
        }
    }

    const where: Prisma.BIConsultaLogWhereInput = {};
    if (desde !== null || hasta !== null) {
        const creadoEn: Prisma.DateTimeFilter = {};
        if (desde !== null) creadoEn.gte = new Date(`${desde}T00:00:00.000Z`);
        // Fin de día inclusive: lte 23:59:59.999 — sin aritmética de días.
        if (hasta !== null) creadoEn.lte = new Date(`${hasta}T23:59:59.999Z`);
        where.creadoEn = creadoEn;
    }
    if (estado !== null) where.estado = estado;

    const [filas, total] = await Promise.all([
        prisma.bIConsultaLog.findMany({
            where,
            orderBy: { creadoEn: "desc" },
            skip: (pagina - 1) * POR_PAGINA,
            take: POR_PAGINA,
            select: {
                id: true,
                preguntaNL: true,
                estado: true,
                latenciaMs: true,
                fuenteCache: true,
                creadoEn: true,
                usuarioId: true,
            },
        }),
        prisma.bIConsultaLog.count({ where }),
    ]);

    return NextResponse.json(
        { filas, total, pagina, paginas: Math.ceil(total / POR_PAGINA) },
        { status: 200 },
    );
}
