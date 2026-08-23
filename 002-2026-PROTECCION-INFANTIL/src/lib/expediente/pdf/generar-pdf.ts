/**
 * SPEC-234 (002-PI-134): generación determinista de PDF de evidencia.
 * Usa pdfmake, fija metadatos de fecha y serializa JSON de forma canónica para
 * garantizar hash reproducible con los mismos datos de entrada.
 * NUNCA incluye texto original de reportes ni datos personales.
 */
import { createHash } from "node:crypto";
import type { InformeConsolidado } from "@prisma/client";
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import type { TDocumentDefinitions, Content, Alignment, StyleDictionary } from "pdfmake/interfaces";

const COLOR_PRIMARIO = "#1d4ed8";
const COLOR_TEXTO = "#1f2937";
const COLOR_MUTED = "#6b7280";

function truncarASegundos(fecha: Date): Date {
    const s = Math.floor(fecha.getTime() / 1000) * 1000;
    return new Date(s);
}

function keysSorted(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(keysSorted);
    if (obj instanceof Date) return obj.toISOString();
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
        sorted[key] = keysSorted((obj as Record<string, unknown>)[key]);
    }
    return sorted;
}

function canonicalJson(obj: unknown): string {
    return JSON.stringify(keysSorted(obj));
}

function parsearSecciones(resumen: string): Content[] {
    const lineas = resumen.split("\n");
    const contenido: Content[] = [];
    let listaActual: string[] | null = null;
    let enLista = false;

    const cerrarLista = () => {
        if (listaActual && listaActual.length > 0) {
            contenido.push({ ul: listaActual, style: "cuerpo" });
            listaActual = null;
            enLista = false;
        }
    };

    for (const linea of lineas) {
        const trimmed = linea.trim();
        if (trimmed.startsWith("# ")) {
            cerrarLista();
            contenido.push({ text: trimmed.slice(2), style: "titulo" });
            continue;
        }
        if (trimmed.startsWith("## ")) {
            cerrarLista();
            contenido.push({ text: trimmed.slice(3), style: "seccion" });
            continue;
        }
        if (trimmed.startsWith("- ")) {
            if (!enLista) {
                listaActual = [];
                enLista = true;
            }
            listaActual!.push(trimmed.slice(2));
            continue;
        }
        if (trimmed === "") {
            continue;
        }
        cerrarLista();
        contenido.push({ text: trimmed, style: "cuerpo" });
    }
    cerrarLista();
    return contenido;
}

export interface PdfResultado {
    buffer: Buffer;
    hash: string;
}

export async function generarPdf(
    informe: Pick<
        InformeConsolidado,
        | "expedienteId"
        | "versionSecuencial"
        | "scoreValor"
        | "scoreGravedad"
        | "categoriasDetectadasJson"
        | "patronesDetectadosJson"
        | "senalComunitariaJson"
        | "resumenTextoGenerado"
        | "pdfGeneradoEn"
    >,
    opts?: { timestamp?: Date }
): Promise<PdfResultado> {
    const timestamp = truncarASegundos(opts?.timestamp ?? informe.pdfGeneradoEn ?? new Date());

    const payload = {
        expedienteId: informe.expedienteId,
        versionSecuencial: informe.versionSecuencial,
        scoreValor: informe.scoreValor,
        scoreGravedad: informe.scoreGravedad,
        categoriasDetectadasJson: informe.categoriasDetectadasJson,
        patronesDetectadosJson: informe.patronesDetectadosJson,
        senalComunitariaJson: informe.senalComunitariaJson,
        pdfGeneradoEn: timestamp.toISOString(),
    };

    const estilos: StyleDictionary = {
        titulo: { fontSize: 18, bold: true, color: COLOR_PRIMARIO, margin: [0, 0, 0, 12] },
        seccion: { fontSize: 13, bold: true, color: COLOR_TEXTO, margin: [0, 14, 0, 6] },
        cuerpo: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    };

    const docDefinition: TDocumentDefinitions = {
        info: {
            title: `Informe consolidado v${informe.versionSecuencial}`,
            author: "Plataforma comunitaria de protección infantil",
            subject: canonicalJson(payload),
            creationDate: timestamp,
            modDate: timestamp,
        },
        content: parsearSecciones(informe.resumenTextoGenerado),
        styles: estilos,
        defaultStyle: { font: "Roboto", color: COLOR_TEXTO },
        footer: (currentPage: number, pageCount: number) => ({
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: "center" as Alignment,
            fontSize: 8,
            color: COLOR_MUTED,
            margin: [0, 8, 0, 0],
        }),
        pageMargins: [40, 40, 40, 40],
    };

    const buffer = await renderPdfBuffer(docDefinition);
    const hash = createHash("sha256").update(buffer).digest("hex");
    return { buffer, hash };
}
