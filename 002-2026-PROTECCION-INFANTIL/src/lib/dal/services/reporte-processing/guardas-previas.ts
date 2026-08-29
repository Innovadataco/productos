import { detectarDoxing } from "@/lib/ai/pii-patterns";
import { registrarPaso } from "@/lib/expediente/pasos";

/**
 * Guardas PREVIAS baratas (spec 092-US4): solo miran texto/frecuencia.
 * Si disparan, el reporte CORTA a REVISION_MANUAL SIN gastar los modelos de
 * clasificación (embudo + rúbrica multi-modelo son el paso caro).
 * Las guardas POSTERIORES (spam del modelo, keywords+OTRO) quedan en guardas.ts.
 */
export function aplicarGuardasPrevias({
    reporteId,
    texto,
    esRafaga,
}: {
    reporteId: string;
    texto: string;
    esRafaga: boolean;
}): { cortar: boolean; prioridadAlta: boolean; keywordsDetectadas: string[]; motivo?: string } {
    // Ráfaga de reportes contra un identificador sin historial: patrón de abuso.
    if (esRafaga) {
        void registrarPaso(reporteId, "guardas", {
            veredicto: "rafaga_detectada",
            detalle: { motivo: "rafaga", prioridadAlta: true, keywordsDetectadas: ["rafaga"] },
        });
        return { cortar: true, prioridadAlta: true, keywordsDetectadas: ["rafaga"], motivo: "rafaga" };
    }

    // Doxing por patrones determinísticos: revisión humana inmediata con prioridad.
    const doxing = detectarDoxing(texto);
    if (doxing.esDoxing) {
        const keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
        void registrarPaso(reporteId, "guardas", {
            veredicto: "doxing_detectado",
            detalle: { motivo: "doxing", prioridadAlta: true, keywordsDetectadas },
        });
        return {
            cortar: true,
            prioridadAlta: true,
            keywordsDetectadas,
            motivo: "doxing",
        };
    }

    void registrarPaso(reporteId, "guardas", { veredicto: "sin_senal", detalle: { esRafaga } });
    return { cortar: false, prioridadAlta: false, keywordsDetectadas: [] };
}
