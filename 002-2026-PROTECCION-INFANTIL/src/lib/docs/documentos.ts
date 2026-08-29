/**
 * SPEC-017 — Lector de documentos del repo (servidor).
 * SOLO lee rutas declaradas en el índice (allowlist): sin traversal ni lectura
 * arbitraria del filesystem. La raíz se resuelve desde el cwd del proceso
 * (el producto); se rechaza cualquier ruta que escape de ella.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buscarDocumentoPermitido } from "./indice";

export interface DocumentoLeido {
    ruta: string;
    titulo: string;
    temaTitulo: string;
    capa: 1 | 2 | 3;
    markdown: string;
}

export async function leerDocumento(ruta: string): Promise<DocumentoLeido | null> {
    const permitido = buscarDocumentoPermitido(ruta);
    if (!permitido) return null;

    const raiz = process.cwd();
    const absoluta = path.resolve(raiz, ruta);
    if (!absoluta.startsWith(raiz + path.sep)) return null;

    let markdown: string;
    try {
        markdown = await fs.readFile(absoluta, "utf-8");
    } catch {
        return null;
    }

    return {
        ruta,
        titulo: permitido.documento.titulo,
        temaTitulo: permitido.tema.titulo,
        capa: permitido.tema.capa,
        markdown,
    };
}
