import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { getParametroSistemaValor } from "@/lib/parametros";
import { mapEstadoUsuario } from "@/lib/reporte-estados-usuario";
import { generarAnalisisRubrica, type VotoRubricaModelo, type VotoRubricaCategoria } from "@/lib/ai/rubrica";
import { formatPlataforma } from "@/lib/plataforma";
import { formatCategoria } from "@/lib/labels";
import { AppError, ERROR_CODES } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

const UMBRAL_PRESENCIA_DEFAULT = 0.6;

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
}

interface CategoriaSecundaria {
    categoria: string;
    score: number;
}

function asCategoriasSecundarias(value: unknown): CategoriaSecundaria[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (v): v is CategoriaSecundaria =>
            typeof v === "object" &&
            v !== null &&
            typeof (v as { categoria?: unknown }).categoria === "string" &&
            typeof (v as { score?: unknown }).score === "number"
    );
}

function parseUmbral(valor: string | null): number {
    if (!valor) return UMBRAL_PRESENCIA_DEFAULT;
    const parsed = parseFloat(valor);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : UMBRAL_PRESENCIA_DEFAULT;
}

/**
 * GET /api/reportes/mis-reportes/[id] — detalle PRIVADO del reporte (spec 090, US3).
 * Solo el dueño (PARENT autenticado) puede verlo. Expone la matriz de la rúbrica
 * (votos por modelo × categoría), los porcentajes de presencia y el análisis
 * determinista. NUNCA expone un "% de riesgo" global ni scores de persona.
 */
export async function GET(_request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await context.params;

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            include: {
                plataforma: { select: { nombre: true, clave: true } },
                clasificacion: {
                    include: { rubricaVotos: { orderBy: [{ modelo: "asc" }, { categoria: "asc" }] } },
                },
            },
        });

        if (!reporte || reporte.eliminado) {
            throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (reporte.usuarioId !== user.id) {
            throw new AppError("Este reporte pertenece a otro usuario", ERROR_CODES.FORBIDDEN, 403);
        }

        const estadoUsuario = mapEstadoUsuario(reporte.estado);

        const clasificacion = reporte.clasificacion;
        if (!clasificacion) {
            // Reporte pendiente/procesando: sin matriz todavía (no es error).
            return NextResponse.json({
                reporte: {
                    id: reporte.id,
                    identificador: reporte.identificador,
                    plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
                    ciudad: reporte.ciudad,
                    pais: reporte.pais,
                    creadoEn: reporte.creadoEn.toISOString(),
                    estadoVisual: estadoUsuario.estadoVisual,
                    badge: estadoUsuario.badge,
                    enProceso: estadoUsuario.enProceso,
                },
                clasificacion: null,
                votosModelos: [],
                porcentajes: {},
                analisis: null,
            });
        }

        // Matriz de la rúbrica: votos agrupados por modelo.
        const porModelo = new Map<string, Record<string, VotoRubricaCategoria>>();
        for (const voto of clasificacion.rubricaVotos) {
            const actual = porModelo.get(voto.modelo) ?? {};
            actual[voto.categoria] = { cumple: voto.cumple, preguntasCumplidas: asStringArray(voto.preguntasJson) };
            porModelo.set(voto.modelo, actual);
        }

        const votosModelos = [...porModelo.entries()].map(([modelo, categorias]) => ({
            modelo,
            categorias: Object.entries(categorias).map(([categoria, v]) => ({
                categoria,
                cumple: v.cumple,
                preguntasCumplidas: v.preguntasCumplidas,
            })),
        }));

        // % por categoría = modelos que marcaron 1 / N modelos.
        const categorias = [...new Set(clasificacion.rubricaVotos.map((v) => v.categoria))].sort();
        const nModelos = Math.max(1, porModelo.size);
        const porcentajes: Record<string, number> = {};
        for (const cat of categorias) {
            const unos = clasificacion.rubricaVotos.filter((v) => v.categoria === cat && v.cumple).length;
            porcentajes[cat] = unos / nModelos;
        }

        const umbral = parseUmbral(await getParametroSistemaValor("ia.rubrica.umbral_presencia"));
        const votosParaAnalisis: VotoRubricaModelo[] = [...porModelo.entries()].map(([modelo, categoriasVoto]) => ({
            modelo,
            categorias: categoriasVoto,
            metrics: { modelo, latenciaMs: 0, promptTokens: null, responseTokens: null, totalDuration: null, loadDuration: null },
            fallback: false,
        }));
        const analisis = generarAnalisisRubrica(votosParaAnalisis, porcentajes, umbral);

        return NextResponse.json({
            reporte: {
                id: reporte.id,
                identificador: reporte.identificador,
                plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
                ciudad: reporte.ciudad,
                pais: reporte.pais,
                creadoEn: reporte.creadoEn.toISOString(),
                estadoVisual: estadoUsuario.estadoVisual,
                badge: estadoUsuario.badge,
                enProceso: estadoUsuario.enProceso,
            },
            clasificacion: {
                categoria: clasificacion.categoria,
                categoriaLabel: formatCategoria(clasificacion.categoria),
                confianza: clasificacion.confianza,
                categoriasSecundarias: asCategoriasSecundarias(clasificacion.categoriasSecundarias),
            },
            votosModelos,
            porcentajes,
            analisis,
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
