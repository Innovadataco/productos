/**
 * SPEC-351 (A-69 · C5 · T011) — el PDF del informe firmado del rector.
 *
 * Membrete: escudo (D1, si está cargado) + nombre + NIT + correlativo
 * INF-AAAA-NNNN + fecha Bogotá. Cuerpo por secciones seleccionadas. Footer:
 * firma del rector (nombre + documento) + código de verificación pública.
 *
 * CANDADO FR-004-bis (CEO 01-09): JAMÁS texto crudo de reportes ni identidad
 * del denunciante. La sección Hechos lleva SOLO fecha/lugar/clasificación —
 * el tipo `HechoInforme` no tiene campo de texto por construcción.
 *
 * Sello (contrato SPEC-234/340): el CÓDIGO se decide ANTES del render y va
 * impreso; el HASH se calcula DESPUÉS sobre el buffer final y nunca entra.
 * Determinista: mismos datos → mismo Buffer.
 */
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import type { TDocumentDefinitions, Content, StyleDictionary } from "pdfmake/interfaces";

const COLOR_PRIMARIO = "#0f766e"; // teal-700 — identidad colegio, nunca rojo
const COLOR_TEXTO = "#1f2937";
const COLOR_MUTED = "#6b7280";

const estilos: StyleDictionary = {
    titulo: { fontSize: 16, bold: true, color: COLOR_PRIMARIO, margin: [0, 0, 0, 2] },
    membrete: { fontSize: 9, color: COLOR_MUTED, margin: [0, 0, 0, 2] },
    correlativo: { fontSize: 11, bold: true, color: COLOR_TEXTO, margin: [0, 6, 0, 10] },
    seccion: { fontSize: 12, bold: true, color: COLOR_TEXTO, margin: [0, 12, 0, 6] },
    cuerpo: { fontSize: 10, color: COLOR_TEXTO, lineHeight: 1.35, margin: [0, 0, 0, 4] },
    nota: { fontSize: 8, color: COLOR_MUTED, italics: true, margin: [0, 6, 0, 0] },
    firma: { fontSize: 10, color: COLOR_TEXTO, margin: [0, 24, 0, 0] },
};

const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
});

/** Un hecho del informe — SIN campo de texto por construcción (FR-004-bis). */
export interface HechoInforme {
    fecha: Date;
    ciudad: string | null;
    pais: string | null;
    plataforma: string | null;
    categoria: string | null;
}

export interface NotaInforme {
    fecha: Date;
    autor: string; // personal del colegio — texto propio, no del denunciante
    texto: string;
}

export type SeccionInforme = "hechos" | "actuacion" | "analisis_comite" | "contexto_curso";

// SPEC-380 (PR B): tipoSujeto para el PDF (mismo shape que en el DAL). No se
// importa el tipo del repo para no acoplar el módulo pdfmake al DAL.
const mapaEtiquetaSujeto: Record<string, string> = {
    ESTUDIANTE: "estudiante",
    PROFESOR: "profesor",
    ACUDIENTE: "acudiente",
    INTEGRANTE_COMITE: "integrante del comité de convivencia",
};

export interface PdfInformeCasoInput {
    colegio: { nombre: string; nit: string };
    escudoDataUri: string | null;
    correlativo: string; // "INF-2026-0001"
    fechaGeneracion: Date;
    tipoSujeto: string;
    curso: string | null;
    secciones: SeccionInforme[];
    hechos: HechoInforme[];
    notas: NotaInforme[];
    analisisComite: { texto: string; firmadoPor: string | null } | null;
    firmadoPorNombre: string;
    firmadoPorDocumento: string;
    codigoVerificacion: string;
    urlVerificacion: string;
}

export async function generarPdfInformeCaso(input: PdfInformeCasoInput): Promise<Buffer> {
    const contenido: Content[] = [];

    // ── Membrete ──
    if (input.escudoDataUri) {
        contenido.push({ image: input.escudoDataUri, fit: [64, 64], margin: [0, 0, 0, 6] });
    }
    contenido.push({ text: input.colegio.nombre, style: "titulo" });
    contenido.push({ text: `NIT ${input.colegio.nit}`, style: "membrete" });
    contenido.push({ text: `Informe del caso · ${fmt.format(input.fechaGeneracion)}`, style: "membrete" });
    contenido.push({ text: input.correlativo, style: "correlativo" });

    // Audit #221 · ajuste 1: el curso SOLO se imprime si la sección
    // "contexto_curso" fue marcada — antes la casilla era un no-op y el
    // curso salía siempre en esta línea.
    const incluirCurso = input.secciones.includes("contexto_curso") && input.curso;
    // SPEC-380 (PR B): mapa legible para el PDF que va a una autoridad —
    // "integrante del comité" en vez de "integrante_comite". El resto también
    // pasa por el mapa para que el registro sea consistente.
    const etiquetaSujeto = mapaEtiquetaSujeto[input.tipoSujeto] ?? input.tipoSujeto.toLowerCase();
    contenido.push({
        text: `Sujeto del caso: ${etiquetaSujeto}${incluirCurso ? ` · curso ${input.curso}` : ""}. ` +
            "Este informe describe hechos y actuaciones; no constituye acusación ni veredicto.",
        style: "cuerpo",
    });

    // ── Hechos ──
    if (input.secciones.includes("hechos")) {
        contenido.push({ text: "Hechos", style: "seccion" });
        if (input.hechos.length === 0) {
            contenido.push({ text: "Sin hechos registrados al corte de este informe.", style: "cuerpo" });
        }
        for (const h of input.hechos) {
            const lugar = [h.ciudad, h.pais].filter(Boolean).join(", ");
            contenido.push({
                text: `• ${fmt.format(h.fecha)}${lugar ? ` · ${lugar}` : ""}${h.plataforma ? ` · ${h.plataforma}` : ""}${h.categoria ? ` · clasificación: ${h.categoria}` : ""}`,
                style: "cuerpo",
            });
        }
        contenido.push({
            text: "Por protección de datos, este informe no incluye el contenido de los reportes ni la identidad de quien reporta.",
            style: "nota",
        });
    }

    // ── Actuación del colegio ──
    if (input.secciones.includes("actuacion")) {
        contenido.push({ text: "Actuación del colegio", style: "seccion" });
        if (input.notas.length === 0) {
            contenido.push({ text: "Sin registros en la bitácora al corte de este informe.", style: "cuerpo" });
        }
        for (const n of input.notas) {
            contenido.push({ text: `• ${fmt.format(n.fecha)} — ${n.autor}: ${n.texto}`, style: "cuerpo" });
        }
    }

    // ── Análisis del comité (si existió · C4) ──
    if (input.secciones.includes("analisis_comite") && input.analisisComite) {
        contenido.push({ text: "Análisis del Comité de Convivencia", style: "seccion" });
        contenido.push({ text: input.analisisComite.texto, style: "cuerpo" });
        if (input.analisisComite.firmadoPor) {
            contenido.push({ text: `Registrado por: ${input.analisisComite.firmadoPor}`, style: "nota" });
        }
    }

    // ── Firma ──
    contenido.push({ text: "____________________________", style: "firma" });
    contenido.push({ text: input.firmadoPorNombre, style: "cuerpo" });
    contenido.push({ text: `Documento: ${input.firmadoPorDocumento}`, style: "cuerpo" });
    contenido.push({ text: "Rector(a) / Representante institucional", style: "nota" });

    const doc: TDocumentDefinitions = {
        info: {
            title: `Informe ${input.correlativo}`,
            // Determinismo (contrato de sello): fecha fija en metadata.
            creationDate: new Date("2026-01-01T00:00:00Z"),
        },
        content: contenido,
        styles: estilos,
        footer: () => ({
            text: `Código de verificación: ${input.codigoVerificacion} · Verifíquelo en ${input.urlVerificacion}`,
            fontSize: 8,
            color: COLOR_MUTED,
            alignment: "center",
            margin: [40, 0, 40, 20],
        }),
        pageMargins: [40, 40, 40, 60],
    };

    return renderPdfBuffer(doc);
}
