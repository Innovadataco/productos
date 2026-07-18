import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { calcularRanking } from "@/lib/ranking";
import { AppError, ERROR_CODES } from "@/lib/errors";


const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ESTADO_VISUAL: Record<string, string> = {
    PENDIENTE: "Recibido",
    PROCESANDO: "En procesamiento",
    CLASIFICADO: "Procesado",
    CORREGIDO: "Procesado",
    REVISION_MANUAL: "En revisión",
    POSIBLE_SPAM: "En revisión",
    REQUIERE_ANONIMIZACION: "En revisión de privacidad",
    DUPLICADO: "Vinculado a reporte existente",
};

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
        const page = Math.max(1, Number(searchParams.get("page") || "1"));
        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
        );
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            prisma.reporte.findMany({
                where: { usuarioId: user.id },
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                include: {
                    clasificacion: true,
                    plataforma: { select: { nombre: true } },
                },
            }),
            prisma.reporte.count({ where: { usuarioId: user.id } }),
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

                return {
                    id: r.id,
                    identificador: r.identificador,
                    plataforma: r.plataforma.nombre,
                    estado: r.estado,
                    estadoVisual: ESTADO_VISUAL[r.estado] || r.estado,
                    numeroSeguimiento: r.numeroSeguimiento,
                    ciudad: r.ciudad,
                    pais: r.pais,
                    esAnonimo: r.esAnonimo,
                    creadoEn: r.creadoEn.toISOString(),
                    clasificacion: r.clasificacion
                        ? {
                            categoria: r.clasificacion.categoria,
                            categoriaLabel: CATEGORIA_LABELS[r.clasificacion.categoria] || r.clasificacion.categoria,
                            confianza: r.clasificacion.confianza,
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
