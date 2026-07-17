import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";

const ULTIMOS_IDENTIFICADORES = 10;

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
            porCiudad,
            porNivelRiesgo,
            ultimosIdentificadores,
            categoriasRaw,
        ] = await Promise.all([
            prisma.reporte.count({ where: { eliminado: false } }),
            prisma.identificadorReportado.count(),
            prisma.reporte.count({ where: { eliminado: false, esAnonimo: false } }),
            prisma.reporte.count({ where: { eliminado: false, esAnonimo: true } }),
            prisma.identificadorReportado.aggregate({
                _avg: { score: true },
            }),
            prisma.reporte.groupBy({
                by: ["plataformaId"],
                _count: { id: true },
                where: { eliminado: false },
            }),
            prisma.reporte.groupBy({
                by: ["pais"],
                _count: { id: true },
                where: { eliminado: false },
                orderBy: { _count: { id: "desc" } },
            }),
            prisma.reporte.groupBy({
                by: ["pais", "ciudad"],
                _count: { id: true },
                where: { eliminado: false },
                orderBy: { _count: { id: "desc" } },
                take: 50,
            }),
            prisma.identificadorReportado.groupBy({
                by: ["nivelRiesgo"],
                where: { nivelRiesgo: { not: null } },
                _count: { identificador: true },
            }),
            prisma.identificadorReportado.findMany({
                orderBy: { actualizadoEn: "desc" },
                take: ULTIMOS_IDENTIFICADORES,
                select: {
                    identificador: true,
                    plataforma: { select: { nombre: true, clave: true } },
                    score: true,
                    nivelRiesgo: true,
                    totalReportes: true,
                    actualizadoEn: true,
                },
            }),
            prisma.clasificacionIA.findMany({
                where: { reporte: { eliminado: false } },
                select: { categoria: true, reporte: { select: { esAnonimo: true } } },
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

        // Agregar categoria agregada
        const porCategoriaMap = new Map<string, number>();
        for (const c of categoriasRaw) {
            porCategoriaMap.set(c.categoria, (porCategoriaMap.get(c.categoria) || 0) + 1);
        }
        const porCategoria = Array.from(porCategoriaMap.entries())
            .map(([categoria, count]) => ({ categoria, count }))
            .sort((a, b) => b.count - a.count);

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
            porCiudad: porCiudad.map((c) => ({
                ciudad: c.ciudad,
                pais: c.pais,
                count: c._count.id,
            })),
            porNivelRiesgo: porNivelRiesgo.map((n) => ({
                nivel: n.nivelRiesgo || "SIN_CLASIFICAR",
                count: n._count.identificador,
            })),
            porCategoria,
            ultimosIdentificadores: ultimosIdentificadores.map((i) => ({
                identificador: i.identificador,
                plataforma: i.plataforma.nombre,
                score: i.score,
                nivelRiesgo: i.nivelRiesgo || "SIN_CLASIFICAR",
                totalReportes: i.totalReportes,
                actualizadoEn: i.actualizadoEn.toISOString(),
            })),
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
