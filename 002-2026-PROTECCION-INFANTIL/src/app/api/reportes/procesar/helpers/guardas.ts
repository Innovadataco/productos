import { detectarDoxing } from "@/lib/ai/pii-patterns";
import { detectarKeywordsRiesgo } from "@/lib/ai/keywords-riesgo";
import type { EstadoReporte } from "@prisma/client";
import type { ClasificacionResult } from "./clasificacion";

export function aplicarGuardasSeguridad({
    texto,
    clasificacion,
    estadoInicial,
    esRafaga,
    umbralSpam,
}: {
    texto: string;
    clasificacion: ClasificacionResult;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
}): {
    estadoFinal: EstadoReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
} {
    let estadoFinal: EstadoReporte = estadoInicial;
    let prioridadAlta = false;
    let keywordsDetectadas: string[] = [];

    // Spec 026: SPAM con confianza suficiente pasa a revisión humana, no se autodestruye
    if (clasificacion.categoria === "SPAM" && clasificacion.confianza >= umbralSpam) {
        estadoFinal = "POSIBLE_SPAM";
    }

    // Guarda de escalamiento DOXING (R3): la regla determinística nunca reclasifica,
    // solo fuerza revisión manual cuando hay señal de doxing que el LLM no reflejó.
    const doxing = detectarDoxing(texto);
    if (estadoFinal !== "POSIBLE_SPAM" && doxing.esDoxing && clasificacion.categoria !== "DOXING") {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
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
        if (estadoFinal === "CLASIFICADO" && clasificacion.categoria === "OTRO") {
            estadoFinal = "REVISION_MANUAL";
        }
    }

    // F7: ráfaga fuerza revisión manual con prioridad alta
    if (estadoFinal !== "POSIBLE_SPAM" && esRafaga) {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
    }

    return { estadoFinal, prioridadAlta, keywordsDetectadas };
}
