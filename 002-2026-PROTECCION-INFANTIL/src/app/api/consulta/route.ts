import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { getUserFromToken } from "@/lib/auth";
import { calcularRanking } from "@/lib/ranking";
import type { EstadoReporte } from "@prisma/client";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
});

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

/**
 * GET /api/consulta?identificador=...&plataforma=...
 * Consulta pública de un identificador reportado.
 *
 * - Usuarios anónimos: información agregada básica (total, distribución geográfica/fechas).
 * - Usuarios autenticados: score de riesgo, nivel de riesgo, categorías agregadas y timeline.
 *
 * Nunca expone textos de reportes ni PII.
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

        const plataforma = await prisma.plataforma.findUnique({
            where: { clave: parsed.data.plataforma },
        });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Parámetros de visibilidad
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.report_threshold" },
        });
        const paramRatio = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.min_authenticated_ratio" },
        });

        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");

        const totalReportes = await prisma.reporte.count({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: ESTADOS_VISIBLES },
            },
        });

        const reportesAutenticados = await prisma.reporte.count({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: ESTADOS_VISIBLES },
                esAnonimo: false,
            },
        });

        const ratioAutenticados = totalReportes > 0 ? reportesAutenticados / totalReportes : 0;
        const esVisible = totalReportes >= umbral && ratioAutenticados >= minRatio;

        const usuario = await getUserFromToken(request);
        const estaAutenticado = !!usuario;

        if (!esVisible) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        // Distribución básica para todos (anónimo y autenticado)
        const reportesVisibles = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: plataforma.id,
                estado: { in: ESTADOS_VISIBLES },
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

        const ubicaciones = reportesVisibles.map((r) => ({
            pais: r.pais,
            ciudad: r.ciudad,
            fecha: r.creadoEn.toISOString().slice(0, 10),
        }));

        const mesesUnicos = [...new Set(reportesVisibles.map((r) => r.creadoEn.toISOString().slice(0, 7)))].sort();
        const resumenMeses = mesesUnicos.length;

        const baseResponse = {
            identificador: parsed.data.identificador,
            plataforma: plataforma.nombre,
            tieneReportes: true,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos: totalReportes - reportesAutenticados,
            ultimoReporte: reportesVisibles[0]?.creadoEn ?? null,
            resumen: `En los últimos ${resumenMeses} mes(es) se han reportado ${totalReportes} vez(es) en ${new Set(ubicaciones.map((u) => u.ciudad)).size} ciudad(es) diferentes.`,
            ubicaciones,
        };

        if (!estaAutenticado) {
            return NextResponse.json(baseResponse);
        }

        // Usuario autenticado: incluir score, categorías y timeline
        const ranking = await calcularRanking(parsed.data.identificador, plataforma.id);

        return NextResponse.json({
            ...baseResponse,
            score: ranking.score,
            nivelRiesgo: ranking.nivelRiesgo,
            ratioAutenticados: ranking.ratioAutenticados,
            categorias: ranking.categorias,
            timeline: ranking.timeline,
            distribucion: ranking.distribucion,
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
