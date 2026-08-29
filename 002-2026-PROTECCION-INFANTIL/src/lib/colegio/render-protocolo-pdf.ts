/**
 * SPEC-154 — Renderizado del PDF del protocolo con @react-pdf/renderer.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { formatoFechaLargaBogota } from "@/lib/fechas/formato-bogota";
import { ProtocoloPDF } from "./pdf-protocolo";

export async function renderProtocoloPDF(colegioNombre: string, titulo: string, markdown: string): Promise<Buffer> {
    const generadoEl = formatoFechaLargaBogota(new Date());
    const element = ProtocoloPDF({ colegioNombre, titulo, markdown, generadoEl });
    const buffer = await renderToBuffer(element);
    return Buffer.from(buffer);
}
