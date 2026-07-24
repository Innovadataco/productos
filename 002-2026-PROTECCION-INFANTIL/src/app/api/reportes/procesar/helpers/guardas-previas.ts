import { detectarDoxing } from "@/lib/ai/pii-patterns";

/**
 * Guardas PREVIAS baratas (spec 092-US4): solo miran texto/frecuencia.
 * Si disparan, el reporte CORTA a REVISION_MANUAL SIN gastar los modelos de
 * clasificación (embudo + rúbrica multi-modelo son el paso caro).
 * Las guardas POSTERIORES (spam del modelo, keywords+OTRO) quedan en guardas.ts.
 */
export function aplicarGuardasPrevias({
    texto,
    esRafaga,
}: {
    texto: string;
    esRafaga: boolean;
}): { cortar: boolean; prioridadAlta: boolean; keywordsDetectadas: string[]; motivo?: string } {
    // Ráfaga de reportes contra un identificador sin historial: patrón de abuso.
    if (esRafaga) {
        return { cortar: true, prioridadAlta: true, keywordsDetectadas: ["rafaga"], motivo: "rafaga" };
    }

    // Doxing por patrones determinísticos: revisión humana inmediata con prioridad.
    const doxing = detectarDoxing(texto);
    if (doxing.esDoxing) {
        return {
            cortar: true,
            prioridadAlta: true,
            keywordsDetectadas: doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"],
            motivo: "doxing",
        };
    }

    return { cortar: false, prioridadAlta: false, keywordsDetectadas: [] };
}
