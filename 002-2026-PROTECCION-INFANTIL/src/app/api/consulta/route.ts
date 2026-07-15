import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { getUserFromToken } from "@/lib/auth";
import { calcularScore } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rate-limit";
import type { EstadoReporte } from "@prisma/client";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
});

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

/**
 * GET /api/consulta?identificador=...
 * Consulta pública de un identificador reportado (número, nick o usuario).
 *
 * - Usuarios anónimos: información agregada básica (total, distribución geográfica/fechas).
 * - Usuarios autenticados: score de riesgo, nivel de riesgo, categorías agregadas y timeline.
 *
 * Nunca expone textos de reportes ni PII.
 */
export async function GET(request: Request) {
    try {
        const rate = await checkRateLimit(request, "consulta");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas consultas. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const identificador = searchParams.get("identificador");

        const parsed = consultaSchema.safeParse({ identificador });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Identificador inválido", code: ERROR_CODES.VALIDATION_ERROR } },
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

        // Reportes visibles del identificador agrupados por plataforma
        const reportesPorPlataforma = await prisma.reporte.groupBy({
            by: ["plataformaId"],
            where: {
                identificador: parsed.data.identificador,
                estado: { in: ESTADOS_VISIBLES },
            },
            _count: { id: true },
        });

        if (reportesPorPlataforma.length === 0) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        const plataformaIdsVisibles: string[] = [];
        const plataformaTotales: Record<string, { total: number; autenticados: number }> = {};

        for (const grupo of reportesPorPlataforma) {
            const total = await prisma.reporte.count({
                where: {
                    identificador: parsed.data.identificador,
                    plataformaId: grupo.plataformaId,
                    estado: { in: ESTADOS_VISIBLES },
                },
            });
            const autenticados = await prisma.reporte.count({
                where: {
                    identificador: parsed.data.identificador,
                    plataformaId: grupo.plataformaId,
                    estado: { in: ESTADOS_VISIBLES },
                    esAnonimo: false,
                },
            });
            const ratio = total > 0 ? autenticados / total : 0;
            if (total >= umbral && ratio >= minRatio) {
                plataformaIdsVisibles.push(grupo.plataformaId);
            }
            plataformaTotales[grupo.plataformaId] = { total, autenticados };
        }

        if (plataformaIdsVisibles.length === 0) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        const plataformas = await prisma.plataforma.findMany({
            where: { id: { in: plataformaIdsVisibles } },
        });

        const totalReportes = plataformaIdsVisibles.reduce(
            (sum, id) => sum + plataformaTotales[id].total,
            0
        );
        const reportesAutenticados = plataformaIdsVisibles.reduce(
            (sum, id) => sum + plataformaTotales[id].autenticados,
            0
        );
        const reportesAnonimos = totalReportes - reportesAutenticados;

        const reportesVisibles = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                plataformaId: { in: plataformaIdsVisibles },
                estado: { in: ESTADOS_VISIBLES },
            },
            select: {
                ciudad: true,
                pais: true,
                creadoEn: true,
                esAnonimo: true,
                plataforma: { select: { nombre: true } },
            },
            orderBy: { creadoEn: "desc" },
            take: 1000,
        });

        const ultimoReporte = reportesVisibles[0]?.creadoEn ?? null;

        const ubicaciones = reportesVisibles.map((r) => ({
            pais: r.pais,
            ciudad: r.ciudad,
            fecha: r.creadoEn.toISOString().slice(0, 10),
        }));

        const mesesUnicos = [...new Set(reportesVisibles.map((r) => r.creadoEn.toISOString().slice(0, 7)))].sort();
        const resumenMeses = mesesUnicos.length;
        const ciudadesUnicas = new Set(ubicaciones.map((u) => u.ciudad)).size;

        const plataformasResponse = plataformaIdsVisibles.map((id) => ({
            id,
            nombre: plataformas.find((p) => p.id === id)?.nombre ?? id,
            totalReportes: plataformaTotales[id].total,
        }));

        const baseResponse = {
            identificador: parsed.data.identificador,
            tieneReportes: true,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            ultimoReporte: ultimoReporte?.toISOString() ?? null,
            plataformas: plataformasResponse,
            resumen: `En los últimos ${resumenMeses} mes(es) se han reportado ${totalReportes} vez(es) en ${ciudadesUnicas} ciudad(es) diferentes y ${plataformasResponse.length} plataforma(s).`,
            ubicaciones,
        };

        const usuario = await getUserFromToken(request);
        const estaAutenticado = !!usuario;

        if (!estaAutenticado) {
            return NextResponse.json(baseResponse);
        }

        // Usuario autenticado: incluir score, categorías y timeline agregados por identificador
        const ranking = await calcularScore(parsed.data.identificador);

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
