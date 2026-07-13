import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
});

/**
 * GET /api/consulta?identificador=...&plataforma=...
 * Consulta pública: devuelve estadísticas agregadas de reportes
 * para un identificador. Nunca muestra etiquetas de culpabilidad.
 * Solo aparece si supera el umbral mínimo configurable.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const identificador = searchParams.get("identificador");
        const plataformaClave = searchParams.get("plataforma");

        const parsed = consultaSchema.safeParse({ identificador, plataforma: plataformaClave });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Obtener plataforma
        const plataforma = await prisma.plataforma.findUnique({
            where: { clave: parsed.data.plataforma },
        });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Buscar identificador reportado
        const agregado = await prisma.identificadorReportado.findUnique({
            where: {
                identificador_plataformaId: {
                    identificador: parsed.data.identificador,
                    plataformaId: plataforma.id,
                },
            },
        });

        // Si no existe en la tabla de agregados, no hay reportes
        if (!agregado) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        // Obtener parámetros de visibilidad
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.report_threshold" },
        });
        const paramRatio = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.min_authenticated_ratio" },
        });

        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");

        // Verificar si supera umbral
        const ratioAutenticados = agregado.totalReportes > 0
            ? agregado.reportesAutenticados / agregado.totalReportes
            : 0;

        const esVisible = agregado.totalReportes >= umbral && ratioAutenticados >= minRatio;

        if (!esVisible) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        // Obtener distribución agregada (solo reportes con estado CLASIFICADO o CORREGIDO)
        const reportesVisibles = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: ["CLASIFICADO", "CORREGIDO"] },
            },
            select: {
                ciudad: true,
                pais: true,
                creadoEn: true,
                esAnonimo: true,
            },
            orderBy: { creadoEn: "desc" },
            take: 1000,
        });

        // Agregar distribución por ciudad
        const porCiudad: Record<string, number> = {};
        const porPais: Record<string, number> = {};
        const porMes: Record<string, number> = {};

        for (const r of reportesVisibles) {
            porCiudad[r.ciudad] = (porCiudad[r.ciudad] || 0) + 1;
            porPais[r.pais] = (porPais[r.pais] || 0) + 1;
            const mes = r.creadoEn.toISOString().slice(0, 7); // YYYY-MM
            porMes[mes] = (porMes[mes] || 0) + 1;
        }

        return NextResponse.json({
            identificador: parsed.data.identificador,
            plataforma: plataforma.nombre,
            tieneReportes: true,
            totalReportes: agregado.totalReportes,
            reportesAutenticados: agregado.reportesAutenticados,
            reportesAnonimos: agregado.reportesAnonimos,
            ultimoReporte: agregado.ultimoReporteEn,
            distribucion: {
                porCiudad,
                porPais,
                porMes,
            },
            // Importante: nunca mostramos etiquetas de culpabilidad
            // ni textos de reportes individuales
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}