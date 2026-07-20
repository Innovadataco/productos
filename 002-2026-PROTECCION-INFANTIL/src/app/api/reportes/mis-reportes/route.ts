import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { calcularRanking } from "@/lib/ranking";
import { getParametroSistemaValor } from "@/lib/parametros";
import { mapEstadoUsuario, getMensajeUsuario, parseSlaHoras } from "@/lib/reporte-estados-usuario";
import { obtenerGruposCategoria, nombreGrupoParaCategoria } from "@/lib/categoria-grupos";
import type { EstadoReporte } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { formatPlataforma } from "@/lib/plataforma";
import { clampPageSize, clampPage } from "@/lib/pagination";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const ESTADOS_CLASIFICACION_FINAL: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
};

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("PARENT");

        const { searchParams } = new URL(request.url);
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"), MAX_PAGE_SIZE);
        const skip = (page - 1) * pageSize;

        const baseWhere = { usuarioId: user.id, eliminado: false };

        const [items, total] = await Promise.all([
            prisma.reporte.findMany({
                where: baseWhere,
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                include: {
                    clasificacion: true,
                    plataforma: { select: { nombre: true, clave: true } },
                },
            }),
            prisma.reporte.count({ where: baseWhere }),
        ]);

        const identificadoresVisibles = new Set(
            (
                await prisma.identificadorReportado.findMany({
                    where: {
                        identificador: { in: items.map((r) => r.identificador) },
                        plataformaId: { in: items.map((r) => r.plataformaId) },
                        esVisiblePublicamente: true,
                    },
                    select: { identificador: true, plataformaId: true },
                })
            ).map((i) => `${i.identificador}::${i.plataformaId}`)
        );

        const rankingCache = new Map<string, Awaited<ReturnType<typeof calcularRanking>>>();
        const rankingKey = (identificador: string, plataformaId: string) => `${identificador}::${plataformaId}`;

        const slaRaw = await getParametroSistemaValor("ui.sla_horas_procesamiento");
        const slaHoras = parseSlaHoras(slaRaw);
        const gruposCategoria = await obtenerGruposCategoria();

        const mapped = await Promise.all(
            items.map(async (r) => {
                const key = rankingKey(r.identificador, r.plataformaId);
                let ranking = null;
                if (identificadoresVisibles.has(key) && !rankingCache.has(key)) {
                    rankingCache.set(key, await calcularRanking(r.identificador, r.plataformaId));
                }
                const cached = rankingCache.get(key);
                if (cached) {
                    ranking = {
                        score: cached.score,
                        nivelRiesgo: cached.nivelRiesgo,
                        totalReportes: cached.totalReportes,
                    };
                }

                const estadoUsuario = mapEstadoUsuario(r.estado);

                return {
                    id: r.id,
                    identificador: r.identificador,
                    plataforma: formatPlataforma(r.plataforma.nombre, r.otraPlataforma, r.plataforma.clave),
                    estadoInterno: r.estado,
                    estadoVisual: estadoUsuario.estadoVisual,
                    badge: estadoUsuario.badge,
                    enProceso: estadoUsuario.enProceso,
                    mensaje: getMensajeUsuario(r.estado, slaHoras),
                    slaHoras,
                    numeroSeguimiento: r.numeroSeguimiento,
                    ciudad: r.ciudad,
                    pais: r.pais,
                    esAnonimo: r.esAnonimo,
                    creadoEn: r.creadoEn.toISOString(),
                    clasificacion:
                        r.clasificacion && ESTADOS_CLASIFICACION_FINAL.includes(r.estado)
                            ? {
                                  categoria: r.clasificacion.categoria,
                                  categoriaLabel:
                                      CATEGORIA_LABELS[r.clasificacion.categoria] || r.clasificacion.categoria,
                                  categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, r.clasificacion.categoria),
                              }
                            : null,
                    ranking,
                };
            })
        );

        return NextResponse.json({
            items: mapped,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
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
