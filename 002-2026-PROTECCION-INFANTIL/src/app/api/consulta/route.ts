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

function formatFecha(date: Date | string) {
    return new Date(date).toISOString().slice(0, 10);
}

/**
 * GET /api/consulta?identificador=...
 * Consulta pública de un identificador reportado (número, nick o usuario).
 *
 * Devuelve un resumen agregado SIN exponer textos de reportes, nombres de
 * personas ni datos personales. Incluye distribución geográfica agregada por
 * ciudad/país, fechas de reporte y del incidente, plataformas y categorías.
 */
export async function GET(request: Request) {
    try {
        const rate = await checkRateLimit(request, "consulta");
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiadas consultas. Intenta más tarde.",
                        code: ERROR_CODES.RATE_LIMITED,
                        retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000),
                    },
                },
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

        // Parámetros de visibilidad (solo para indicar si aparece en el dashboard público)
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.report_threshold" },
        });
        const paramRatio = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.min_authenticated_ratio" },
        });
        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");

        // Reportes visibles del identificador (CLASIFICADO / CORREGIDO)
        const reportes = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                estado: { in: ESTADOS_VISIBLES },
                eliminado: false,
            },
            select: {
                id: true,
                ciudad: true,
                pais: true,
                creadoEn: true,
                fechaIncidente: true,
                esAnonimo: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                clasificacion: { select: { categoria: true, confianza: true } },
            },
            orderBy: { creadoEn: "desc" },
            take: 1000,
        });

        if (reportes.length === 0) {
            return NextResponse.json({
                identificador: parsed.data.identificador,
                tieneReportes: false,
                mensaje: "Sin reportes registrados para este identificador.",
            });
        }

        const totalReportes = reportes.length;
        const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
        const reportesAnonimos = totalReportes - reportesAutenticados;
        const ratioAutenticados = totalReportes > 0 ? reportesAutenticados / totalReportes : 0;
        const visibleEnDashboard = totalReportes >= umbral && ratioAutenticados >= minRatio;
        const ultimoReporte = reportes[0]?.creadoEn ?? null;
        const primerReporte = reportes[reportes.length - 1]?.creadoEn ?? null;

        // Plataformas
        const porPlataforma = new Map<string, { id: string; nombre: string; clave: string; total: number }>();
        for (const r of reportes) {
            const p = r.plataforma;
            const actual = porPlataforma.get(p.id) || { id: p.id, nombre: p.nombre, clave: p.clave, total: 0 };
            actual.total += 1;
            porPlataforma.set(p.id, actual);
        }
        const plataformas = Array.from(porPlataforma.values()).sort((a, b) => b.total - a.total);

        // Categorías
        const porCategoria = new Map<string, { categoria: string; total: number; confianzas: number[] }>();
        for (const r of reportes) {
            const cat = r.clasificacion?.categoria;
            if (!cat) continue;
            const actual = porCategoria.get(cat) || { categoria: cat, total: 0, confianzas: [] };
            actual.total += 1;
            if (r.clasificacion?.confianza != null) {
                actual.confianzas.push(r.clasificacion.confianza);
            }
            porCategoria.set(cat, actual);
        }
        const categorias = Array.from(porCategoria.values())
            .map((c) => ({
                categoria: c.categoria,
                total: c.total,
                confianzaPromedio:
                    c.confianzas.length > 0
                        ? Number((c.confianzas.reduce((a, b) => a + b, 0) / c.confianzas.length).toFixed(2))
                        : null,
            }))
            .sort((a, b) => b.total - a.total);

        // Ubicaciones agregadas por ciudad/país (sin coordenadas)
        const ubicacionKey = (r: (typeof reportes)[0]) => `${r.pais}|${r.ciudad}`;
        const porUbicacion = new Map<
            string,
            {
                pais: string;
                ciudad: string;
                total: number;
                fechasReporte: string[];
                fechasIncidente: string[];
            }
        >();

        for (const r of reportes) {
            const key = ubicacionKey(r);
            const actual = porUbicacion.get(key) || {
                pais: r.pais,
                ciudad: r.ciudad,
                total: 0,
                fechasReporte: [] as string[],
                fechasIncidente: [] as string[],
            };
            actual.total += 1;
            actual.fechasReporte.push(formatFecha(r.creadoEn));
            actual.fechasIncidente.push(formatFecha(r.fechaIncidente));
            porUbicacion.set(key, actual);
        }
        const ubicaciones = Array.from(porUbicacion.values())
            .map((u) => ({
                ...u,
                fechasReporte: [...new Set(u.fechasReporte)].sort().reverse(),
                fechasIncidente: [...new Set(u.fechasIncidente)].sort().reverse(),
            }))
            .sort((a, b) => b.total - a.total);

        // Timeline mensual
        const porMes = new Map<string, number>();
        for (const r of reportes) {
            const mes = formatFecha(r.creadoEn).slice(0, 7);
            porMes.set(mes, (porMes.get(mes) || 0) + 1);
        }
        const timeline = Array.from(porMes.entries())
            .map(([mes, total]) => ({ mes, total }))
            .sort((a, b) => a.mes.localeCompare(b.mes));

        const ciudadesUnicas = new Set(reportes.map((r) => r.ciudad)).size;
        const paisesUnicos = new Set(reportes.map((r) => r.pais)).size;

        const baseResponse = {
            identificador: parsed.data.identificador,
            tieneReportes: true,
            visibleEnDashboard,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            primerReporte: primerReporte?.toISOString() ?? null,
            ultimoReporte: ultimoReporte?.toISOString() ?? null,
            plataformas,
            categorias,
            ubicaciones,
            timeline,
            resumen: `Se han reportado ${totalReportes} vez(es) entre ${formatFecha(primerReporte || new Date())} y ${formatFecha(ultimoReporte || new Date())} en ${ciudadesUnicas} ciudad(es) de ${paisesUnicos} país(es) y ${plataformas.length} plataforma(s).`,
        };

        const usuario = await getUserFromToken(request);
        const estaAutenticado = !!usuario;

        if (!estaAutenticado) {
            return NextResponse.json(baseResponse);
        }

        // Usuario autenticado: incluir score y nivel de riesgo
        const ranking = await calcularScore(parsed.data.identificador);

        return NextResponse.json({
            ...baseResponse,
            score: ranking.score,
            nivelRiesgo: ranking.nivelRiesgo,
            ratioAutenticados: ranking.ratioAutenticados,
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
