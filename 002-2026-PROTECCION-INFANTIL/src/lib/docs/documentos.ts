/**
 * SPEC-017 — Lector de documentos del repo (servidor).
 * SOLO lee rutas declaradas en el índice (allowlist): sin traversal ni lectura
 * arbitraria del filesystem. La raíz se resuelve desde el cwd del proceso
 * (el producto); se rechaza cualquier ruta que escape de ella.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";
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
    } catch (err) {
        // SPEC-567 (I-351): la ruta ESTÁ en el allowlist pero el archivo no está en el runtime.
        // Eso NO es «no encontrado» (404, que es clave desconocida) — es una imagen mal armada:
        // el doc no se embarcó en la etapa runner del Dockerfile (o quedó dockerignored). Fail-loud
        // con log de servidor y throw → 500, para que un hueco de despliegue sea RUIDOSO, no silencioso.
        logger.error(
            `[docs] Documento del allowlist ausente en runtime: ${ruta} (${absoluta}). ` +
                "¿Falta la COPY en el Dockerfile runner o está dockerignored?",
            err
        );
        throw new Error(`Documento del allowlist no disponible en runtime: ${ruta}`);
    }

    return {
        ruta,
        titulo: permitido.documento.titulo,
        temaTitulo: permitido.tema.titulo,
        capa: permitido.tema.capa,
        markdown,
    };
}
