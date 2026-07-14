import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import type { EstadoReporte } from "@prisma/client";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
});

/**
 * GET /api/consulta?identificador=...&plataforma=...
 * Consulta pública: devuelve estadísticas agregadas de reportes
 * para un identificador. Nunca muestra etiquetas de culpabilidad.
 * Solo aparece si supera el umbral mínimo configurable.
 * REQUIERE_ANONIMIZACION, PENDIENTE, PROCESANDO, POSIBLE_SPAM,
 * REVISION_MANUAL, DUPLICADO NUNCA cuentan para el umbral.
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

        // Obtener parámetros de visibilidad
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.report_threshold" },
        });
        const paramRatio = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.min_authenticated_ratio" },
        });

        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");

        // Contar en vivo: solo reportes en estado CLASIFICADO o CORREGIDO
        const estadosVisibles = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

        const totalReportes = await prisma.reporte.count({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: estadosVisibles },
            },
        });

        const reportesAutenticados = await prisma.reporte.count({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: estadosVisibles },
                esAnonimo: false,
            },
        });

        const reportesAnonimos = totalReportes - reportesAutenticados;

        // Verificar si supera umbral
        const ratioAutenticados = totalReportes > 0
            ? reportesAutenticados / totalReportes
            : 0;

        const esVisible = totalReportes >= umbral && ratioAutenticados >= minRatio;

        if (!esVisible) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        // Obtener distribución agregada
        const reportesVisibles = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: estadosVisibles },
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
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            ultimoReporte: reportesVisibles[0]?.creadoEn ?? null,
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