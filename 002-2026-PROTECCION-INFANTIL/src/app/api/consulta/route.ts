import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/auth";
import { formatPlataforma, formatPlataformasResumen } from "@/lib/plataforma";
import { whereReporteAprobado, CATEGORIAS_NO_APROBADAS } from "@/lib/reporte-aprobado";
import { obtenerSeveridades } from "@/lib/scoring";
import { getParametroSistema } from "@/lib/parametros";
import type { CategoriaConducta } from "@prisma/client";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
});

function formatFecha(date: Date | string) {
    return new Date(date).toISOString().slice(0, 10);
}

/**
 * GET /api/consulta?identificador=...
 * Consulta pública de un identificador reportado (número, nick o usuario).
 *
 * Informa con hechos agregados, NUNCA juzga a la persona (sin nivelRiesgo ni score —
 * spec 089-US6). Solo cuenta reportes aprobados (spec 089-US3: estado CLASIFICADO/
 * CORREGIDO, categoría ∉ {SPAM,OTRO}, no eliminado).
 * Divulgación progresiva: anónimo = resumen; autenticado = ciudad, timeline,
 * plataformas completas e informe.
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

        // Divulgación progresiva (US7): sesión opcional, nunca bloquea al anónimo.
        // El token se lee del header cookie de la Request (sin next/headers: funciona
        // también fuera de request scope, p. ej. en tests de integración).
        const cookieHeader = request.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)(?:__Host-token|token)=([^;]+)/);
        const payload = tokenMatch ? await verifyToken(tokenMatch[1]) : null;
        const autenticado = !!payload;

        // Parámetros de visibilidad (listado del dashboard; la consulta directa siempre muestra detalle — US5)
        const paramUmbral = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.report_threshold" },
        });
        const paramRatio = await prisma.parametroSistema.findUnique({
            where: { clave: "visibility.min_authenticated_ratio" },
        });
        const paramActividad = await getParametroSistema("visibility.actividad_alta_min", prisma);
        const umbral = parseInt(paramUmbral?.valor || "3", 10);
        const minRatio = parseFloat(paramRatio?.valor || "0.5");
        const actividadAltaMin = parseInt(paramActividad?.valor || "5", 10);

        // Reportes APROBADOS del identificador (predicado único spec 089-US3)
        const reportes = await prisma.reporte.findMany({
            where: whereReporteAprobado({ identificador: parsed.data.identificador }),
            select: {
                id: true,
                ciudad: true,
                pais: true,
                creadoEn: true,
                fechaIncidente: true,
                esAnonimo: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                clasificacion: { select: { categoria: true, confianza: true, categoriasSecundarias: true } },
                ciudadRel: { select: { nombre: true, lat: true, lng: true, departamento: { select: { nombre: true } } } },
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

        // Señal descriptiva (US5/US6): describe los DATOS, no el riesgo del identificador
        const actividad = totalReportes >= actividadAltaMin ? "alta" : "baja";

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

        // Categorías (US4): principal + secundarias, sin SPAM/OTRO, ordenadas por gravedad
        const severidades = await obtenerSeveridades();
        const conteoCategorias = new Map<string, number>();
        for (const r of reportes) {
            const principal = r.clasificacion?.categoria;
            if (principal && !(CATEGORIAS_NO_APROBADAS as readonly string[]).includes(principal)) {
                conteoCategorias.set(principal, (conteoCategorias.get(principal) ?? 0) + 1);
            }
            const secundarias = (r.clasificacion?.categoriasSecundarias ?? []) as Array<{ categoria?: string }>;
            for (const s of secundarias) {
                const cat = s.categoria;
                if (cat && !(CATEGORIAS_NO_APROBADAS as readonly string[]).includes(cat)) {
                    conteoCategorias.set(cat, (conteoCategorias.get(cat) ?? 0) + 1);
                }
            }
        }
        const categorias = Array.from(conteoCategorias.entries())
            .map(([categoria, total]) => ({ categoria, total, severidad: severidades[categoria as CategoriaConducta] ?? 0 }))
            .sort((a, b) => b.severidad - a.severidad || b.total - a.total)
            .map(({ categoria, total }) => ({ categoria, total }));

        // Ubicación: anónimo = rollup por PAÍS; autenticado = departamento/ciudad
        let ubicaciones: unknown[];
        if (!autenticado) {
            const porPais = new Map<string, number>();
            for (const r of reportes) {
                porPais.set(r.pais, (porPais.get(r.pais) ?? 0) + 1);
            }
            ubicaciones = Array.from(porPais.entries())
                .map(([pais, total]) => ({ pais, total }))
                .sort((a, b) => b.total - a.total);
        } else {
            const porUbicacion = new Map<
                string,
                { pais: string; departamento: string | null; ciudad: string; total: number; lat: number | null; lng: number | null }
            >();
            for (const r of reportes) {
                const departamento = r.ciudadRel?.departamento?.nombre ?? null;
                const ciudad = r.ciudadRel?.nombre ?? r.ciudad;
                const key = `${r.pais}|${departamento ?? ""}|${ciudad}`;
                const actual = porUbicacion.get(key) || {
                    pais: r.pais,
                    departamento,
                    ciudad,
                    total: 0,
                    lat: r.ciudadRel?.lat ?? null,
                    lng: r.ciudadRel?.lng ?? null,
                };
                actual.total += 1;
                porUbicacion.set(key, actual);
            }
            ubicaciones = Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total);
        }

        const ciudadesUnicas = new Set(reportes.map((r) => r.ciudad)).size;
        const paisesUnicos = new Set(reportes.map((r) => r.pais)).size;

        // Respuesta base (anónimo = resumen)
        const respuesta: Record<string, unknown> = {
            identificador: parsed.data.identificador,
            tieneReportes: true,
            visibleEnDashboard,
            actividad,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            plataformas,
            resumenPlataformas: formatPlataformasResumen(plataformas, totalReportes),
            categorias,
            ubicaciones,
            autenticado,
        };

        // Divulgación progresiva (US5/US7): detalle solo autenticado
        if (autenticado) {
            const porMes = new Map<string, number>();
            for (const r of reportes) {
                const mes = formatFecha(r.creadoEn).slice(0, 7);
                porMes.set(mes, (porMes.get(mes) || 0) + 1);
            }
            const timeline = Array.from(porMes.entries())
                .map(([mes, total]) => ({ mes, total }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            respuesta.primerReporte = primerReporte?.toISOString() ?? null;
            respuesta.ultimoReporte = ultimoReporte?.toISOString() ?? null;
            respuesta.timeline = timeline;
            respuesta.resumen = `Se han reportado ${totalReportes} vez(es) entre ${formatFecha(primerReporte || new Date())} y ${formatFecha(ultimoReporte || new Date())} en ${ciudadesUnicas} ciudad(es) de ${paisesUnicos} país(es) y ${plataformas.length} plataforma(s).`;
        }

        return NextResponse.json(respuesta);
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
