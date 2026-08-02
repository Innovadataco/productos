import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { clasificarConVotos } from "@/lib/ai/classifier";
import { clasificarConRubrica, cargarConfigRubrica } from "@/lib/ai/rubrica";
import type { ResultadoRubrica } from "@/lib/ai/rubrica";
import { detectarPiiCombinado } from "@/lib/ai/pii-detector";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
import { aJson } from "../../json";
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
    /** Solo motor legacy de votos con cascada. */
    usoCascada?: boolean | undefined;
    /** Solo motor legacy de votos con cascada. */
    modeloCascada?: string | undefined;
    /** Tokens del motor (rúbrica los reporta; legacy no). */
    promptTokens?: number | null | undefined;
    /** Tokens del motor (rúbrica los reporta; legacy no). */
    responseTokens?: number | null | undefined;
    /** Resultado completo de la rúbrica (para persistir la matriz de votos). */
    __rubrica?: ResultadoRubrica | undefined;
}

/** Compat: la rúbrica no reporta agresor-par hoy; si el motor lo añade, se respeta. */
function leerPosibleAgresorPar(r: ResultadoRubrica): boolean {
    return "posibleAgresorPar" in r && typeof r.posibleAgresorPar === "boolean" ? r.posibleAgresorPar : false;
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
}): Promise<{ clasificacion: ClasificacionResult; piiResult: Awaited<ReturnType<typeof detectarPiiCombinado>> | undefined }> {
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
        return { clasificacion, piiResult: undefined };
    }

    // Spec 090: motor por rúbrica multi-etiqueta/multi-modelo si está habilitado
    // (ia.rubrica.enabled); si no, motor legacy de votos del mismo modelo.
    const configRubrica = await cargarConfigRubrica();

    const [clasifResult, piiResult]: [ClasificacionResult, Awaited<ReturnType<typeof detectarPiiCombinado>>] = await Promise.all([
        configRubrica.enabled
            ? clasificarConRubrica(texto, configRubrica).then((r): ClasificacionResult => ({
                  categoria: r.categoria,
                  confianza: r.confianza,
                  categoriasSecundarias: r.categoriasSecundarias,
                  posibleAgresorPar: leerPosibleAgresorPar(r),
                  estado: r.estado,
                  metrics: { modelo: r.metrics.modelo, latenciaMs: r.metrics.latenciaMs },
                  rawResponse: r.rawResponse,
                  votos: r.votosModelos,
                  promptTokens: r.metrics.promptTokens,
                  responseTokens: r.metrics.responseTokens,
                  usoCascada: false,
                  modeloCascada: undefined,
                  __rubrica: r,
              }))
            : clasificarConVotos(parametros.modeloClasificacion, texto, {
                  nVotos: parametros.nVotos,
                  temperatura: parametros.temperaturaVotos,
                  minScoreCategoria: parametros.minScoreCategoria,
                  umbralRevision: parametros.umbralRevision,
                  ollamaNumParallel: parametros.ollamaNumParallel,
                  ejemplos: ejemplosRag,
                  ...(parametros.modeloDesempate !== undefined ? { modeloDesempate: parametros.modeloDesempate } : {}),
                  keepAliveDesempate: 0,
              }),
        detectarPiiCombinado(parametros.modeloAnonimizacion, texto),
    ]);

    const clasificacion: ClasificacionResult = { ...clasifResult };

    try {
        const clasificacionCreada = await prisma.clasificacionIA.create({
            data: {
                reporteId,
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                contienePii: piiResult.contienePii,
                piiDetectada: piiResult.piiDetectada,
                categoriasSecundarias: aJson(clasificacion.categoriasSecundarias),
                votos: aJson(clasificacion.votos),
                posibleAgresorPar: clasificacion.posibleAgresorPar,
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                ...(clasificacion.usoCascada !== undefined ? { usoCascada: clasificacion.usoCascada } : {}),
                ...(clasificacion.modeloCascada !== undefined ? { modeloCascada: clasificacion.modeloCascada } : {}),
                modeloUsado: clasificacion.metrics.modelo,
                latenciaMs: clasificacion.metrics.latenciaMs + piiResult.metrics.latenciaMs,
                promptTokens: clasificacion.promptTokens ?? null,
                responseTokens: clasificacion.responseTokens ?? null,
                rawResponse: String(clasificacion.rawResponse),
            },
        });

        // Spec 090: persistir la matriz categoría × modelo × 0/1 (con preguntas cumplidas)
        const rubrica = clasifResult.__rubrica;
        if (rubrica && Array.isArray(rubrica.votosModelos)) {
            const filas = rubrica.votosModelos.flatMap((vm) =>
                Object.entries(vm.categorias).map(([categoria, v]) => ({
                    clasificacionIAId: clasificacionCreada.id,
                    modelo: vm.modelo,
                    categoria,
                    cumple: v.cumple,
                    preguntasJson: v.preguntasCumplidas,
                }))
            );
            if (filas.length > 0) {
                await prisma.clasificacionRubricaVoto.createMany({ data: filas });
            }
        }
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
