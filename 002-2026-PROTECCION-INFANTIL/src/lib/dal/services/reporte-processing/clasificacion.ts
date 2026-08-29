import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { clasificarConMotorActivo } from "@/lib/ai/motor";
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

    // SPEC-138 (E-7): el único motor activo es la rúbrica, configurada desde
    // los parámetros ia.rubrica.*. El mismo selector vive en src/lib/ai/motor.ts
    // y lo ejercita el sandbox.
    // SPEC-298 (I-163): propagar `parametros.modeloClasificacion` al motor para que la rúbrica
    // vote con ese único modelo (mono-voz). El fallback en parametros.ts:68 garantiza cadena
    // no vacía; sin este pase, el override del sandbox se descartaba y toda simulación votaba
    // con el mismo comité → misma accuracy.
    const [resultado, piiResult] = await Promise.all([
        clasificarConMotorActivo(texto, { modeloClasificacion: parametros.modeloClasificacion }),
        detectarPiiCombinado(parametros.modeloAnonimizacion, texto),
    ]);

    const clasificacion: ClasificacionResult = {
        categoria: resultado.categoria,
        confianza: resultado.confianza,
        categoriasSecundarias: resultado.categoriasSecundarias,
        posibleAgresorPar: resultado.posibleAgresorPar,
        estado: resultado.estado,
        metrics: { modelo: resultado.metrics.modelo, latenciaMs: resultado.metrics.latenciaMs },
        rawResponse: resultado.rawResponse,
        votos: resultado.votos,
        promptTokens: resultado.metrics.promptTokens ?? null,
        responseTokens: resultado.metrics.responseTokens ?? null,
        __rubrica: resultado.rubrica,
    };

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
                modeloUsado: clasificacion.metrics.modelo,
                latenciaMs: clasificacion.metrics.latenciaMs + piiResult.metrics.latenciaMs,
                promptTokens: clasificacion.promptTokens ?? null,
                responseTokens: clasificacion.responseTokens ?? null,
                rawResponse: String(clasificacion.rawResponse),
            },
        });

        // Spec 090: persistir la matriz categoría × modelo × 0/1 (con preguntas cumplidas)
        const rubrica = clasificacion.__rubrica;
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
