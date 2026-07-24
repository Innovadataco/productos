import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { obtenerGruposCategoria, agruparCategorias } from "@/lib/categoria-grupos";
import { whereReporteAprobado, ESTADOS_APROBADOS, CATEGORIAS_NO_APROBADAS } from "@/lib/reporte-aprobado";

export async function GET() {
    try {
        const [
            totalReportes,
            identificadoresUnicos,
            reportesAutenticados,
            reportesAnonimos,
            scorePromedio,
            porPlataforma,
            porPais,
            porCiudadConIds,
            categoriasRaw,
        ] = await Promise.all([
            prisma.reporte.count({ where: whereReporteAprobado() }),
            prisma.identificadorReportado.count(),
            prisma.reporte.count({ where: whereReporteAprobado({ esAnonimo: false }) }),
            prisma.reporte.count({ where: whereReporteAprobado({ esAnonimo: true }) }),
            prisma.identificadorReportado.aggregate({
                _avg: { score: true },
            }),
            prisma.reporte.groupBy({
                by: ["plataformaId"],
                _count: { id: true },
                where: whereReporteAprobado(),
            }),
            prisma.reporte.groupBy({
                by: ["pais"],
                _count: { id: true },
                where: whereReporteAprobado(),
                orderBy: { _count: { id: "desc" } },
            }),
            prisma.reporte.groupBy({
                by: ["ciudadId"],
                _count: { id: true },
                where: whereReporteAprobado({ ciudadId: { not: null } }),
                orderBy: { _count: { id: "desc" } },
                take: 50,
            }),
            prisma.clasificacionIA.findMany({
                where: {
                    categoria: { notIn: [...CATEGORIAS_NO_APROBADAS] },
                    reporte: { estado: { in: [...ESTADOS_APROBADOS] }, eliminado: false },
                },
                select: { categoria: true },
            }),
        ]);

        const plataformaIds = porPlataforma.map((p) => p.plataformaId).filter((id): id is string => !!id);
        const plataformasMap =
            plataformaIds.length > 0
                ? Object.fromEntries(
                      (
                          await prisma.plataforma.findMany({
                              where: { id: { in: plataformaIds } },
                              select: { id: true, nombre: true },
                          })
                      ).map((p) => [p.id, p.nombre])
                  )
                : {};

        const ciudadIds = porCiudadConIds.map((c) => c.ciudadId).filter((id): id is string => !!id);
        const ciudadesConCoords =
            ciudadIds.length > 0
                ? await prisma.ciudad.findMany({
                      where: { id: { in: ciudadIds } },
                      select: { id: true, nombre: true, pais: { select: { nombre: true } }, lat: true, lng: true },
                  })
                : [];

        const ciudadesMap = Object.fromEntries(ciudadesConCoords.map((c) => [c.id, c]));

        const porCiudad = porCiudadConIds.map((c) => {
            const ciudad = ciudadesMap[c.ciudadId || ""];
            return {
                ciudad: ciudad?.nombre || "Desconocida",
                pais: ciudad?.pais.nombre || "Desconocido",
                count: c._count.id,
                lat: ciudad?.lat ?? null,
                lng: ciudad?.lng ?? null,
            };
        });

        const gruposCategoria = await obtenerGruposCategoria();

        const porCategoriaMap = new Map<string, number>();
        for (const c of categoriasRaw) {
            porCategoriaMap.set(c.categoria, (porCategoriaMap.get(c.categoria) || 0) + 1);
        }
        const porCategoria = Array.from(porCategoriaMap.entries())
            .map(([categoria, count]) => ({ categoria, count }))
            .sort((a, b) => b.count - a.count);

        const porGrupoCategoria = agruparCategorias(
            gruposCategoria,
            porCategoria.map((c) => ({ categoria: c.categoria, total: c.count }))
        );

        return NextResponse.json({
            totales: {
                reportes: totalReportes,
                identificadoresUnicos,
                reportesAutenticados,
                reportesAnonimos,
                scorePromedio: Math.round(scorePromedio._avg.score ?? 0),
            },
            porPlataforma: porPlataforma.map((p) => ({
                plataforma: plataformasMap[p.plataformaId || ""] || "Desconocida",
                count: p._count.id,
            })),
            porPais: porPais.map((p) => ({ pais: p.pais, count: p._count.id })),
            porCiudad,
            porCategoria,
            porGrupoCategoria,
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
