/**
 * SPEC-136 (E-3) / SPEC-140: úNICA augmentation tipada del build CJS de pdfmake
 * 0.3.x en Node — `createPdf` acepta la firma legacy de 4 argumentos (el 4º es
 * el vfs) y la instancia expone `vfs` mutable. Los @types/pdfmake solo declaran
 * la firma de 2 argumentos. Centralizada aquí porque una augmentation es global:
 * declararla en más de un archivo rompe tsc (TS2451).
 * Consumidores: `src/lib/colegio/pdf-estadisticas.ts`,
 * `src/lib/expediente/pdf-denuncia.ts`, `src/lib/expediente/expediente-forense.ts`.
 */
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, TVirtualFileSystem, TCreatedPdf } from "pdfmake/interfaces";

declare module "pdfmake/build/pdfmake" {
    let vfs: TVirtualFileSystem;
    function createPdf(
        documentDefinitions: TDocumentDefinitions,
        tableLayouts: undefined,
        fonts: undefined,
        vfs: TVirtualFileSystem
    ): TCreatedPdf;
}

// pdfmake requiere registrar las fuentes virtuales en Node
pdfMake.vfs = pdfFonts;

/** Renderiza el documento a un Buffer en memoria (NADA se persiste). */
export function renderPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return pdfMake.createPdf(docDefinition, undefined, undefined, pdfFonts).getBuffer();
}
