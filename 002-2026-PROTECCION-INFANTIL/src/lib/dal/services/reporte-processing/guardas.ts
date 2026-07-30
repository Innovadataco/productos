import { detectarDoxing } from "@/lib/ai/pii-patterns";
import { detectarKeywordsRiesgo } from "@/lib/ai/keywords-riesgo";
import { registrarPaso } from "@/lib/expediente/pasos";
import type { EstadoReporte } from "@prisma/client";
import type { ClasificacionResult } from "./clasificacion";

export function aplicarGuardasSeguridad({
    reporteId,
    texto,
    clasificacion,
    estadoInicial,
    esRafaga,
    umbralSpam,
}: {
    reporteId: string;
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
    const reglasAplicadas: string[] = [];

    // Spec 026: SPAM con confianza suficiente pasa a revisión humana, no se autodestruye
    if (clasificacion.categoria === "SPAM" && clasificacion.confianza >= umbralSpam) {
        estadoFinal = "POSIBLE_SPAM";
        reglasAplicadas.push("spam_confianza_alta");
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

    // Spec 096-US3: razón explícita de la regla de decisión (best-effort).
    void registrarPaso(reporteId, "decision", {
        veredicto: estadoFinal,
        detalle: {
            estadoInicial,
            reglas: reglasAplicadas,
            prioridadAlta,
            keywordsDetectadas,
            categoria: clasificacion.categoria,
            confianza: clasificacion.confianza,
        },
    });

    return { estadoFinal, prioridadAlta, keywordsDetectadas };
}
