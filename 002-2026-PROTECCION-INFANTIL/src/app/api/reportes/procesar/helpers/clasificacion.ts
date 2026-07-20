import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { clasificarConVotos } from "@/lib/ai/classifier";
import { detectarPiiCombinado } from "@/lib/ai/pii-detector";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
import type { ParametrosClasificacion } from "./parametros";
import type { EjemploRecuperado } from "@/lib/ai/dataset-retrieval";

export interface ClasificacionResult {
    categoria: CategoriaConducta;
    confianza: number;
    categoriasSecundarias: unknown[];
    posibleAgresorPar: boolean;
    estado: EstadoReporte;
    metrics: { modelo: string; latenciaMs: number };
    rawResponse: unknown;
    votos: unknown[];
}

export async function clasificarReporte({
    reporteId,
    texto,
    parametros,
    ejemplosRag,
}: {
    reporteId: string;
    texto: string;
    parametros: Pick<
        ParametrosClasificacion,
        "modeloClasificacion" | "modeloAnonimizacion" | "umbralRevision" | "nVotos" | "temperaturaVotos" | "minScoreCategoria" | "ollamaNumParallel" | "modeloDesempate"
    >;
    ejemplosRag: EjemploRecuperado[];
}): Promise<{ clasificacion: ClasificacionResult; piiResult: Awaited<ReturnType<typeof detectarPiiCombinado>> }> {
    const clasifExistente = await prisma.clasificacionIA.findUnique({
        where: { reporteId },
    });

    if (clasifExistente) {
        const clasificacion: ClasificacionResult = {
            categoria: clasifExistente.categoria,
            confianza: clasifExistente.confianza,
            categoriasSecundarias: Array.isArray(clasifExistente.categoriasSecundarias) ? clasifExistente.categoriasSecundarias : [],
            posibleAgresorPar: clasifExistente.posibleAgresorPar,
            estado: (clasifExistente.contienePii ? "REQUIERE_ANONIMIZACION" : "CLASIFICADO") as EstadoReporte,
            metrics: { modelo: clasifExistente.modeloUsado, latenciaMs: clasifExistente.latenciaMs },
            rawResponse: clasifExistente.rawResponse,
            votos: Array.isArray(clasifExistente.votos) ? clasifExistente.votos : [],
        };
        return { clasificacion, piiResult: undefined as unknown as Awaited<ReturnType<typeof detectarPiiCombinado>> };
    }

    const [clasifResult, piiResult] = await Promise.all([
        clasificarConVotos(parametros.modeloClasificacion, texto, {
            nVotos: parametros.nVotos,
            temperatura: parametros.temperaturaVotos,
            minScoreCategoria: parametros.minScoreCategoria,
            umbralRevision: parametros.umbralRevision,
            ollamaNumParallel: parametros.ollamaNumParallel,
            ejemplos: ejemplosRag,
            modeloDesempate: parametros.modeloDesempate,
            keepAliveDesempate: 0,
        }),
        detectarPiiCombinado(parametros.modeloAnonimizacion, texto),
    ]);

    const clasificacion: ClasificacionResult = { ...clasifResult };

    try {
        await prisma.clasificacionIA.create({
            data: {
                reporteId,
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                contienePii: piiResult.contienePii,
                piiDetectada: piiResult.piiDetectada,
                categoriasSecundarias: clasificacion.categoriasSecundarias as unknown as Prisma.InputJsonValue,
                votos: clasificacion.votos as unknown as Prisma.InputJsonValue,
                posibleAgresorPar: clasificacion.posibleAgresorPar,
                usoCascada: (clasificacion as unknown as Record<string, unknown>).usoCascada as boolean | undefined,
                modeloCascada: (clasificacion as unknown as Record<string, unknown>).modeloCascada as string | undefined,
                modeloUsado: clasificacion.metrics.modelo,
                latenciaMs: clasificacion.metrics.latenciaMs + piiResult.metrics.latenciaMs,
                promptTokens: (clasificacion as unknown as Record<string, unknown>).promptTokens as number | null,
                responseTokens: (clasificacion as unknown as Record<string, unknown>).responseTokens as number | null,
                rawResponse: String(clasificacion.rawResponse) as string | undefined,
            },
        });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const clasifRecuperada = await prisma.clasificacionIA.findUnique({
                where: { reporteId },
            });
            if (clasifRecuperada) {
                return {
                    clasificacion: {
                        categoria: clasifRecuperada.categoria,
                        confianza: clasifRecuperada.confianza,
                        categoriasSecundarias: Array.isArray(clasifRecuperada.categoriasSecundarias) ? clasifRecuperada.categoriasSecundarias : [],
                        posibleAgresorPar: clasifRecuperada.posibleAgresorPar,
                        estado: (clasifRecuperada.contienePii ? "REQUIERE_ANONIMIZACION" : "CLASIFICADO") as EstadoReporte,
                        metrics: { modelo: clasifRecuperada.modeloUsado, latenciaMs: clasifRecuperada.latenciaMs },
                        rawResponse: clasifRecuperada.rawResponse,
                        votos: Array.isArray(clasifRecuperada.votos) ? clasifRecuperada.votos : [],
                    },
                    piiResult,
                };
            }
            throw err;
        } else {
            throw err;
        }
    }

    return { clasificacion, piiResult };
}
