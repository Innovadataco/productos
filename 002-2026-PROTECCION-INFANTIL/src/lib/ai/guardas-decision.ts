import { detectarDoxing } from "./pii-patterns";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

/**
 * FUENTE ÚNICA de la decisión de las guardas de seguridad (spec 123, E-4).
 *
 * La decisión (mismo orden de ramas y mismos cortocircuitos
 * `estadoFinal !== "POSIBLE_SPAM"`):
 *
 *   1. SPAM con confianza >= umbralSpam → POSIBLE_SPAM
 *   2. Doxing determinístico no reflejado por el modelo → REVISION_MANUAL
 *   3. Keywords críticas con OTRO/REVISION_MANUAL → prioridad alta (+ REVISION_MANUAL si era CLASIFICADO)
 *   4. Ráfaga → REVISION_MANUAL con prioridad alta
 *
 * La usan TODOS los contextos: producción (vía el wrapper fino
 * `aplicarGuardasSeguridad` de `reporte-processing/guardas.ts`, que añade el
 * side-effect `registrarPaso` de expediente) y el sandbox. Antes era una réplica de la lógica de producción; desde E-4
 * ES la implementación de producción. La decisión bit a bit idéntica la
 * afirman `guardas-decision.test.ts` y los tests del pipeline.
 */

export interface GuardasClasificacion {
    categoria: CategoriaConducta;
    confianza: number;
}

export interface CategoriaSecundaria {
    categoria: string;
    score: number;
}

export function normalizarCategoriasSecundarias(val: unknown): CategoriaSecundaria[] {
    if (!Array.isArray(val)) return [];
    return val.filter((item): item is CategoriaSecundaria => {
        if (typeof item !== "object" || item === null) return false;
        const record = item as Record<string, unknown>;
        return typeof record.categoria === "string" && typeof record.score === "number";
    });
}

export interface GuardasDecision {
    estadoFinal: EstadoReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    reglasAplicadas: string[];
    doxing: { esDoxing: boolean; fragmentos: string[] };
    keywordsRiesgo: { tieneMatch: boolean; keywords: string[] };
}

export function decidirGuardasSeguridad({
    texto,
    clasificacion,
    categoriasSecundarias,
    estadoInicial,
    esRafaga,
    umbralSpam,
    umbralSpamDominancia,
    severidadMinGrave,
    severidades,
}: {
    texto: string;
    clasificacion: GuardasClasificacion;
    categoriasSecundarias: CategoriaSecundaria[];
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
    umbralSpamDominancia: number;
    severidadMinGrave: number;
    severidades: Record<string, number>;
}): GuardasDecision {
    let estadoFinal: EstadoReporte = estadoInicial;
    let prioridadAlta = false;
    let keywordsDetectadas: string[] = [];
    const reglasAplicadas: string[] = [];

    // Spec 026: SPAM con confianza suficiente pasa a revisión humana, no se autodestruye
    if (clasificacion.categoria === "SPAM" && clasificacion.confianza >= umbralSpam) {
        estadoFinal = "POSIBLE_SPAM";
        reglasAplicadas.push("spam_confianza_alta");
    }

    // SPEC-199: dominancia SPAM. Si SPAM vota fuerte entre las categorías
    // presentes y ninguna es lo suficientemente grave, forzar POSIBLE_SPAM.
    // Esto protege contra falsos positivos de rúbricas laxas (ej.
    // OFRECIMIENTO_REGALOS clasificando publicidad masiva).
    if (estadoFinal !== "POSIBLE_SPAM") {
        const spamSecundario = categoriasSecundarias.find((c) => c.categoria === "SPAM");
        if (spamSecundario && spamSecundario.score >= umbralSpamDominancia) {
            const presentes: CategoriaSecundaria[] = [
                { categoria: clasificacion.categoria, score: clasificacion.confianza },
                ...categoriasSecundarias,
            ];
            const hayCategoriaGrave = presentes.some((c) => (severidades[c.categoria] ?? 0) >= severidadMinGrave);
            if (!hayCategoriaGrave) {
                estadoFinal = "POSIBLE_SPAM";
                reglasAplicadas.push("spam_dominancia");
            }
        }
    }

    // Guarda de escalamiento DOXING (R3): la regla determinística nunca reclasifica,
    // solo fuerza revisión manual cuando hay señal de doxing que el LLM no reflejó.
    const doxing = detectarDoxing(texto);
    if (estadoFinal !== "POSIBLE_SPAM" && doxing.esDoxing && clasificacion.categoria !== "DOXING") {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
        reglasAplicadas.push("doxing_no_reflejado_por_modelo");
    }

    // F7: guarda de keywords críticas. Nunca reclasifica; fuerza revisión manual
    // cuando el modelo clasificó como OTRO pero hay señales de riesgo graves.
    const keywordsRiesgo = detectarKeywordsRiesgo(texto);
    if (
        estadoFinal !== "POSIBLE_SPAM" &&
        keywordsRiesgo.tieneMatch &&
        ((estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") || estadoFinal === "REVISION_MANUAL")
    ) {
        prioridadAlta = true;
        keywordsDetectadas = Array.from(new Set([...keywordsDetectadas, ...keywordsRiesgo.keywords]));
        reglasAplicadas.push("keywords_riesgo");
        if (estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") {
            estadoFinal = "REVISION_MANUAL";
        }
    }

    // F7: ráfaga fuerza revisión manual con prioridad alta
    if (estadoFinal !== "POSIBLE_SPAM" && esRafaga) {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        reglasAplicadas.push("rafaga");
    }

    return { estadoFinal, prioridadAlta, keywordsDetectadas, reglasAplicadas, doxing, keywordsRiesgo };
}
