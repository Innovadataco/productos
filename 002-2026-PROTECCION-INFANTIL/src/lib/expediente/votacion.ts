import { getParametroSistema } from "@/lib/parametros";
import { RUBRICA_SEMILLA, type SetsRubrica } from "@/lib/ai/rubrica-semilla";
import type { ClasificacionIA, ClasificacionRubricaVoto } from "@prisma/client";

/**
 * Votación del expediente (spec 096-US2).
 * Matriz modelos×categorías y detalle pregunta por pregunta. La ÚNICA fuente
 * de votos es `ClasificacionRubricaVoto` (NUNCA `ClasificacionIA.votos`, Json
 * redundante — deuda registrada en data-model.md). El texto y el tipo
 * (decisiva/contexto) de cada pregunta se leen EN VIVO del parámetro
 * `ia.rubrica.preguntas`: si un experto lo edita, la salida cambia sin desplegar.
 */

export interface PreguntaVotacion {
    texto: string;
    tipo: "decisiva" | "contexto";
    votosPorModelo: Record<string, number>;
}

export interface DetalleCategoria {
    categoria: string;
    preguntas: PreguntaVotacion[];
}

export interface VotacionExpediente {
    categorias: string[];
    confianza: number;
    usoCascada: boolean;
    modeloCascada: string | null;
    latenciaMs: number;
    promptTokens: number | null;
    responseTokens: number | null;
    matriz: Record<string, Record<string, number>>;
    detallePorCategoria: DetalleCategoria[];
}

export type ClasificacionConVotos = ClasificacionIA & { rubricaVotos: ClasificacionRubricaVoto[] };

function categoriasDeClasificacion(c: ClasificacionIA): string[] {
    const secundarias = Array.isArray(c.categoriasSecundarias) ? c.categoriasSecundarias : [];
    const cats: string[] = [c.categoria];
    for (const s of secundarias) {
        if (typeof s === "object" && s !== null && "categoria" in s) {
            const cat = (s as { categoria: unknown }).categoria;
            if (typeof cat === "string" && !cats.includes(cat)) cats.push(cat);
        }
    }
    return cats;
}

function preguntasCumplidasDe(preguntasJson: unknown): Set<string> {
    if (!Array.isArray(preguntasJson)) return new Set();
    return new Set(preguntasJson.filter((x): x is string => typeof x === "string"));
}

/** Builder puro: cruza los votos persistidos con las preguntas dadas. */
export function armarVotacion(clasificacion: ClasificacionConVotos, preguntas: SetsRubrica): VotacionExpediente {
    const matriz: Record<string, Record<string, number>> = {};
    const cumplidasPorModelo = new Map<string, Set<string>>();
    const modelosPorCategoria = new Map<string, string[]>();

    for (const voto of clasificacion.rubricaVotos) {
        (matriz[voto.categoria] ??= {})[voto.modelo] = voto.cumple ? 1 : 0;
        cumplidasPorModelo.set(`${voto.modelo}||${voto.categoria}`, preguntasCumplidasDe(voto.preguntasJson));
        const modelos = modelosPorCategoria.get(voto.categoria) ?? [];
        if (!modelos.includes(voto.modelo)) modelos.push(voto.modelo);
        modelosPorCategoria.set(voto.categoria, modelos);
    }

    const detallePorCategoria: DetalleCategoria[] = [...modelosPorCategoria.entries()].map(([categoria, modelos]) => {
        const preguntasCat = (preguntas[categoria] ?? []).filter((p) => p.activo);
        return {
            categoria,
            preguntas: preguntasCat.map((p) => ({
                texto: p.texto,
                tipo: p.tipo === "decisiva" ? ("decisiva" as const) : ("contexto" as const),
                votosPorModelo: Object.fromEntries(
                    modelos.map((m) => [m, cumplidasPorModelo.get(`${m}||${categoria}`)?.has(p.texto) ? 1 : 0])
                ),
            })),
        };
    });

    return {
        categorias: categoriasDeClasificacion(clasificacion),
        confianza: clasificacion.confianza,
        usoCascada: clasificacion.usoCascada,
        modeloCascada: clasificacion.modeloCascada,
        latenciaMs: clasificacion.latenciaMs,
        promptTokens: clasificacion.promptTokens,
        responseTokens: clasificacion.responseTokens,
        matriz,
        detallePorCategoria,
    };
}

/** Lee el parámetro VIVO `ia.rubrica.preguntas` (cae a la semilla si falta o es inválido). */
export async function cargarPreguntasRubrica(): Promise<SetsRubrica> {
    const param = await getParametroSistema("ia.rubrica.preguntas");
    if (!param) return RUBRICA_SEMILLA;
    try {
        const parsed: unknown = JSON.parse(param.valor);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return RUBRICA_SEMILLA;
        return parsed as SetsRubrica;
    } catch {
        return RUBRICA_SEMILLA;
    }
}

/** Versión async: carga el parámetro en vivo y arma la votación. */
export async function armarVotacionExpediente(clasificacion: ClasificacionConVotos): Promise<VotacionExpediente> {
    return armarVotacion(clasificacion, await cargarPreguntasRubrica());
}
