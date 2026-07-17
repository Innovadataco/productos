import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWorkerMetrics } from "@/lib/queue-metrics";
import { AppError, ERROR_CODES } from "@/lib/errors";

function calcularPrecisionPorCategoria(
    confirmaciones: { categoriaOriginal: string; _count: { categoriaOriginal: number } }[],
    correcciones: { categoriaOriginal: string; _count: { categoriaOriginal: number } }[]
) {
    const confirmadasMap = new Map<string, number>();
    for (const c of confirmaciones) {
        confirmadasMap.set(c.categoriaOriginal, c._count.categoriaOriginal);
    }
    const corregidasMap = new Map<string, number>();
    for (const c of correcciones) {
        corregidasMap.set(c.categoriaOriginal, c._count.categoriaOriginal);
    }

    const categorias = new Set([...confirmadasMap.keys(), ...corregidasMap.keys()]);
    return Array.from(categorias).map((categoria) => {
        const confirmadas = confirmadasMap.get(categoria) || 0;
        const corregidas = corregidasMap.get(categoria) || 0;
        const totalRevisados = confirmadas + corregidas;
        return {
            categoria,
            confirmadas,
            corregidas,
            totalRevisados,
            precisionObservada: totalRevisados === 0 || totalRevisados < 5 ? null : confirmadas / totalRevisados,
        };
    });
}

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoySig = new Date(hoy);
        hoySig.setDate(hoySig.getDate() + 1);

        const treintaDiasAtras = new Date(hoy);
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

        const [
            totalReportes,
            reportesHoy,
            pendientesRevision,
            pendientesAnonimizacion,
            reportesAnonimos,
            reportesAutenticados,
            porEstado,
            porCategoria,
            porPlataforma,
            porCiudad,
            tendencia,
            workerMetrics,
            confirmacionesPorCategoria,
            correccionesPorCategoria,
        ] = await Promise.all([
            prisma.reporte.count({ where: { eliminado: false } }),
            prisma.reporte.count({ where: { eliminado: false, creadoEn: { gte: hoy, lt: hoySig } } }),
            prisma.reporte.count({ where: { eliminado: false, estado: { in: ["REVISION_MANUAL", "PROCESANDO"] } } }),
            prisma.reporte.count({ where: { eliminado: false, estado: "REQUIERE_ANONIMIZACION" } }),
            prisma.reporte.count({ where: { eliminado: false, esAnonimo: true } }),
            prisma.reporte.count({ where: { eliminado: false, esAnonimo: false } }),
            prisma.reporte.groupBy({ by: ["estado"], _count: { estado: true }, where: { eliminado: false } }),
            prisma.clasificacionIA.groupBy({ by: ["categoria"], _count: { categoria: true }, where: { reporte: { eliminado: false } } }),
            prisma.reporte.groupBy({ by: ["plataformaId"], _count: { plataformaId: true }, where: { eliminado: false, plataformaId: { not: "" } } }),
            prisma.reporte.groupBy({ by: ["ciudad"], _count: { ciudad: true }, where: { eliminado: false, ciudad: { not: "" } }, take: 10, orderBy: { _count: { ciudad: "desc" } } }),
            prisma.reporte.groupBy({
                by: ["creadoEn"],
                _count: { creadoEn: true },
                where: { eliminado: false, creadoEn: { gte: treintaDiasAtras } },
                orderBy: { creadoEn: "asc" },
            }),
            getWorkerMetrics(),
            prisma.correccionAdmin.groupBy({
                by: ["categoriaOriginal"],
                _count: { categoriaOriginal: true },
                where: { confirmada: true, clasificacion: { reporte: { eliminado: false } } },
            }),
            prisma.correccionAdmin.groupBy({
                by: ["categoriaOriginal"],
                _count: { categoriaOriginal: true },
                where: { confirmada: false, clasificacion: { reporte: { eliminado: false } } },
            }),
        ]);

        const plataformaIds = porPlataforma
            .map((p) => p.plataformaId)
            .filter((id): id is string => id !== null && id !== undefined);
        const plataformasMap = await prisma.plataforma.findMany({
            where: { id: { in: plataformaIds } },
            select: { id: true, nombre: true },
        });
        const plataformaNombrePorId = Object.fromEntries(plataformasMap.map((p) => [p.id, p.nombre]));

        const tendenciaDiaria: Record<string, number> = {};
        for (const t of tendencia) {
            const fecha = t.creadoEn.toISOString().split("T")[0];
            tendenciaDiaria[fecha] = (tendenciaDiaria[fecha] || 0) + t._count.creadoEn;
        }
        const tendenciaArray = Object.entries(tendenciaDiaria)
            .map(([fecha, count]) => ({ fecha, count }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        return NextResponse.json({
            totales: {
                reportes: totalReportes,
                reportesHoy,
                pendientesRevision,
                pendientesAnonimizacion,
                reportesAnonimos,
                reportesAutenticados,
            },
            porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count.estado })),
            porCategoria: porCategoria.map((c) => ({ categoria: c.categoria, count: c._count.categoria })),
            porPlataforma: porPlataforma.map((p) => ({ plataforma: plataformaNombrePorId[p.plataformaId || ""] || "Desconocida", count: typeof p._count === "object" ? p._count.plataformaId : 0 })),
            porCiudad: porCiudad.map((c) => ({ ciudad: c.ciudad, count: typeof c._count === "object" ? c._count.ciudad : 0 })),
            tendencia: tendenciaArray,
            worker: workerMetrics,
            precisionPorCategoria: calcularPrecisionPorCategoria(confirmacionesPorCategoria, correccionesPorCategoria),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}