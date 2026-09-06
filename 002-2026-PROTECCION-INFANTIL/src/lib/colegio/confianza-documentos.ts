import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

export interface DocumentoConfianza {
    clave: string;
    titulo: string;
    ruta: string;
}

export const DOCUMENTOS_CONFIANZA: DocumentoConfianza[] = [
    { clave: "transparencia", titulo: "Transparencia institucional", ruta: "docs/rector/transparencia.md" },
    { clave: "protocolo", titulo: "Protocolo de uso", ruta: "docs/rector/protocolo.md" },
    { clave: "compromiso", titulo: "Compromiso de buen uso", ruta: "docs/rector/compromiso.md" },
];

const RUTAS_PERMITIDAS = new Map(DOCUMENTOS_CONFIANZA.map((d) => [d.ruta, d]));

export interface DocumentoLeido {
    clave: string;
    titulo: string;
    ruta: string;
    markdown: string;
}

/**
 * Lee un documento de confianza desde la allowlist cerrada.
 * Previene path traversal: resuelve contra el cwd y rechaza rutas que escapen.
 */
export async function leerDocumentoConfianza(clave: string): Promise<DocumentoLeido | null> {
    const documento = DOCUMENTOS_CONFIANZA.find((d) => d.clave === clave);
    if (!documento) return null;

    const permitido = RUTAS_PERMITIDAS.get(documento.ruta);
    if (!permitido) return null;

    const raiz = process.cwd();
    const absoluta = path.resolve(raiz, documento.ruta);
    if (!absoluta.startsWith(raiz + path.sep)) return null;

    let markdown: string;
    try {
        markdown = await fs.readFile(absoluta, "utf-8");
    } catch (err) {
        // SPEC-567 (I-351): clave del allowlist con archivo ausente en runtime = imagen mal armada
        // (el doc no se embarcó en la etapa runner del Dockerfile), NO «no encontrado». Fail-loud:
        // log + throw → 500, para que el hueco de despliegue sea RUIDOSO.
        logger.error(
            `[confianza] Documento del allowlist ausente en runtime: ${documento.ruta} (${absoluta}). ` +
                "¿Falta la COPY en el Dockerfile runner o está dockerignored?",
            err
        );
        throw new Error(`Documento de confianza no disponible en runtime: ${documento.clave}`);
    }

    return {
        clave: documento.clave,
        titulo: documento.titulo,
        ruta: documento.ruta,
        markdown,
    };
}
