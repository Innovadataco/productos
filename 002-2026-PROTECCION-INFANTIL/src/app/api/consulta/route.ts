import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import type { EstadoReporte } from "@prisma/client";
import { formatPlataforma, formatPlataformasResumen } from "@/lib/plataforma";
import { getRiesgoConsultaParams, calcularRiesgoConsulta } from "@/lib/riesgo-consulta";

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
                ciudadRel: { select: { lat: true, lng: true } },
                otraPlataforma: true,
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

        // Plataformas (agrupadas respetando el nombre personalizado en "otro")
        const porPlataforma = new Map<
            string,
            { id: string; nombre: string; clave: string; total: number; otraPlataforma: string | null }
        >();
        for (const r of reportes) {
            const p = r.plataforma;
            const key = p.clave === "otro" && r.otraPlataforma ? `otro:${r.otraPlataforma}` : p.id;
            const actual = porPlataforma.get(key) || {
                id: p.id,
                nombre: formatPlataforma(p.nombre, r.otraPlataforma, p.clave),
                clave: p.clave,
                total: 0,
                otraPlataforma: p.clave === "otro" ? r.otraPlataforma : null,
            };
            actual.total += 1;
            porPlataforma.set(key, actual);
        }
        const plataformas = Array.from(porPlataforma.values()).sort((a, b) => b.total - a.total);

        // Ubicaciones agregadas por ciudad/país
        const ubicacionKey = (r: (typeof reportes)[0]) => `${r.pais}|${r.ciudad}`;
        const porUbicacion = new Map<
            string,
            {
                pais: string;
                ciudad: string;
                total: number;
                fechasReporte: string[];
                fechasIncidente: string[];
                lat: number | null;
                lng: number | null;
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
                lat: r.ciudadRel?.lat ?? null,
                lng: r.ciudadRel?.lng ?? null,
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

        const riesgoParams = await getRiesgoConsultaParams();
        const riesgo = calcularRiesgoConsulta(reportes, riesgoParams);

        return NextResponse.json({
            identificador: parsed.data.identificador,
            tieneReportes: true,
            visibleEnDashboard,
            nivelRiesgo: riesgo.nivelRiesgo,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            primerReporte: primerReporte?.toISOString() ?? null,
            ultimoReporte: ultimoReporte?.toISOString() ?? null,
            plataformas,
            resumenPlataformas: formatPlataformasResumen(plataformas, totalReportes),
            ubicaciones,
            timeline,
            resumen: `Se han reportado ${totalReportes} vez(es) entre ${formatFecha(primerReporte || new Date())} y ${formatFecha(ultimoReporte || new Date())} en ${ciudadesUnicas} ciudad(es) de ${paisesUnicos} país(es) y ${plataformas.length} plataforma(s).`,
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
