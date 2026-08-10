/**
 * SPEC-154 — Renderizado del PDF del protocolo con @react-pdf/renderer.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { ProtocoloPDF } from "./pdf-protocolo";

export async function renderProtocoloPDF(colegioNombre: string, titulo: string, markdown: string): Promise<Buffer> {
    const generadoEl = new Date().toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const element = ProtocoloPDF({ colegioNombre, titulo, markdown, generadoEl });
    const buffer = await renderToBuffer(element);
    return Buffer.from(buffer);
}
