import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatPlataforma, formatPlataformasResumen } from "@/lib/plataforma";
import { getRiesgoConsultaParams, calcularRiesgoConsulta } from "@/lib/riesgo-consulta";
import { obtenerGruposCategoria, nombreGrupoParaCategoria } from "@/lib/categoria-grupos";
import type { EstadoReporte } from "@prisma/client";

const consultaSchema = z.object({
    identificador: z.string().min(3).max(100),
});

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
};

function formatFecha(date: Date | string) {
    return new Date(date).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
    try {
        let user: Awaited<ReturnType<typeof verifyAuth>>;
        try {
            user = await verifyAuth("PARENT");
        } catch {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const rate = await checkRateLimit(request, "consulta_detalle");
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

        const reportes = await prisma.reporte.findMany({
            where: {
                identificador: parsed.data.identificador,
                estado: { in: ESTADOS_VISIBLES },
                eliminado: false,
            },
            select: {
                id: true,
                esAnonimo: true,
                creadoEn: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                otraPlataforma: true,
                ciudad: true,
                pais: true,
                ciudadRel: { select: { lat: true, lng: true } },
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

        const riesgoParams = await getRiesgoConsultaParams();
        const riesgoGlobal = calcularRiesgoConsulta(reportes, riesgoParams);
        const gruposCategoria = await obtenerGruposCategoria();

        const totalReportes = reportes.length;
        const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
        const reportesAnonimos = totalReportes - reportesAutenticados;
        const ultimoReporte = reportes[0]?.creadoEn ?? null;

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

        const porUbicacion = new Map<
            string,
            { pais: string; ciudad: string; total: number; lat: number | null; lng: number | null }
        >();
        for (const r of reportes) {
            const key = `${r.pais}|${r.ciudad}`;
            const actual = porUbicacion.get(key) || {
                pais: r.pais,
                ciudad: r.ciudad,
                total: 0,
                lat: r.ciudadRel?.lat ?? null,
                lng: r.ciudadRel?.lng ?? null,
            };
            actual.total += 1;
            porUbicacion.set(key, actual);
        }
        const ubicaciones = Array.from(porUbicacion.values()).sort((a, b) => b.total - a.total);

        const itemsReportes = reportes.map((r) => {
            const riesgoIndividual = calcularRiesgoConsulta([r], riesgoParams);
            const categoria = r.clasificacion?.categoria ?? "OTRO";
            return {
                id: r.id,
                plataforma: formatPlataforma(r.plataforma.nombre, r.otraPlataforma, r.plataforma.clave),
                esAnonimo: r.esAnonimo,
                fecha: formatFecha(r.creadoEn),
                categoria,
                categoriaLabel: CATEGORIA_LABELS[categoria] || "Otro",
                categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, categoria),
                confianza: r.clasificacion?.confianza ?? 0,
                nivelRiesgo: riesgoIndividual.nivelRiesgo,
            };
        });

        return NextResponse.json({
            identificador: parsed.data.identificador,
            tieneReportes: true,
            nivelRiesgo: riesgoGlobal.nivelRiesgo,
            confianzaPromedio: riesgoGlobal.confianzaPromedio,
            totalReportes,
            reportesAutenticados,
            reportesAnonimos,
            ultimoReporte: ultimoReporte?.toISOString() ?? null,
            plataformas,
            resumenPlataformas: formatPlataformasResumen(plataformas, totalReportes),
            reportes: itemsReportes,
            ubicaciones,
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
