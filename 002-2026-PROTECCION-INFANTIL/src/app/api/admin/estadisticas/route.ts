import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { getWorkerMetrics } from "@/lib/queue-metrics";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET() {
    try {
        const user = await verifyAuth();
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
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
        ] = await Promise.all([
            prisma.reporte.count(),
            prisma.reporte.count({ where: { creadoEn: { gte: hoy, lt: hoySig } } }),
            prisma.reporte.count({ where: { estado: { in: ["REVISION_MANUAL", "PROCESANDO"] } } }),
            prisma.reporte.count({ where: { estado: "REQUIERE_ANONIMIZACION" } }),
            prisma.reporte.count({ where: { esAnonimo: true } }),
            prisma.reporte.count({ where: { esAnonimo: false } }),
            prisma.reporte.groupBy({ by: ["estado"], _count: { estado: true } }),
            prisma.clasificacionIA.groupBy({ by: ["categoria"], _count: { categoria: true } }),
            prisma.reporte.groupBy({ by: ["plataformaId"], _count: { plataformaId: true }, where: { plataformaId: { not: "" } } }),
            prisma.reporte.groupBy({ by: ["ciudad"], _count: { ciudad: true }, where: { ciudad: { not: "" } }, take: 10, orderBy: { _count: { ciudad: "desc" } } }),
            prisma.reporte.groupBy({
                by: ["creadoEn"],
                _count: { creadoEn: true },
                where: { creadoEn: { gte: treintaDiasAtras } },
                orderBy: { creadoEn: "asc" },
            }),
            getWorkerMetrics(),
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