/**
 * SPEC-323 (T017/US4): PDF del expediente personal del padre.
 * Documento probatorio en memoria — no se retiene en servidor.
 * Reglas duras (constitución §1.3 + Ley 1581):
 * (a) eventosPropios: texto descifrado solo del dueño (AD-3 opción C);
 * (b) contextoOtros: solo fecha/ciudad/país/clasificación — SIN texto, sin autor;
 * (c) lenguaje descriptivo; sin veredictos; presunción de inocencia;
 * (d) determinista: mismos datos → mismo Buffer (info.creationDate fijo).
 * Patrón pdfmake igual que pdf-denuncia.ts y pdf-estadisticas.ts.
 */
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import type { TDocumentDefinitions, Content, StyleDictionary } from "pdfmake/interfaces";

const COLOR_PRIMARIO = "#1d4ed8"; // blue-700
const COLOR_TEXTO = "#1f2937";   // gray-800
const COLOR_MUTED = "#6b7280";   // gray-500

const estilos: StyleDictionary = {
    titulo: { fontSize: 18, bold: true, color: COLOR_PRIMARIO, margin: [0, 0, 0, 4] },
    subtitulo: { fontSize: 10, color: COLOR_MUTED, margin: [0, 0, 0, 14] },
    seccion: { fontSize: 13, bold: true, color: COLOR_TEXTO, margin: [0, 12, 0, 6] },
    label: { fontSize: 9, color: COLOR_MUTED, margin: [0, 0, 0, 1] },
    valor: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    cuerpo: { fontSize: 11, color: COLOR_TEXTO, lineHeight: 1.4, margin: [0, 0, 0, 4] },
    nota: { fontSize: 9, color: COLOR_MUTED, italics: true, margin: [0, 8, 0, 0] },
};

type ClasificacionItem = { categoria: string; confianza: number };

export interface EventoPropioParaPdf {
    ordenSecuencial: number;
    fechaEvento: Date;
    textoDescifrado: string;
    reporte: {
        ciudad: string | null;
        pais: string | null;
        fechaIncidente: Date;
        clasificacion: ClasificacionItem | null;
    } | null;
}

export interface ContextoOtroParaPdf {
    fechaEvento: Date;
    reporte: {
        ciudad: string | null;
        pais: string | null;
        clasificacion: ClasificacionItem | null;
    } | null;
}

export interface PdfExpedienteInput {
    identificadorReportado: string;
    fechaApertura: Date;
    padreEmail: string;
    padreNombre?: string | null;
    eventosPropios: EventoPropioParaPdf[];
    contextoOtros: ContextoOtroParaPdf[];
    fechaGeneracion: Date;
    // SPEC-340 (§4.3): el sello. El CÓDIGO se decide ANTES de renderizar y va
    // impreso; el HASH se calcula DESPUÉS sobre el buffer final y NUNCA entra
    // al documento (evitaría su propia verificación — contrato de SPEC-234).
    codigoVerificacion?: string;
    urlVerificacion?: string;
}

const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
});

const fmtDate = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
});

function formatearFecha(d: Date) { return fmt.format(d); }
function formatearSoloFecha(d: Date) { return fmtDate.format(d); }

function categoriaLegible(cat: string) {
    return cat.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function clasificacionTexto(c: ClasificacionItem | null) {
    if (!c) return "Sin clasificación";
    return categoriaLegible(c.categoria);
}

function seccionEventoPropio(ev: EventoPropioParaPdf): Content {
    const lugar = [ev.reporte?.ciudad, ev.reporte?.pais].filter(Boolean).join(", ") || "No especificado";
    const ficha: Content = [
        { text: `Evento #${ev.ordenSecuencial}`, style: "seccion" },
        { text: "Fecha del evento", style: "label" },
        { text: formatearFecha(ev.fechaEvento), style: "valor" },
        { text: "Lugar reportado", style: "label" },
        { text: lugar, style: "valor" },
    ];
    if (ev.reporte?.fechaIncidente) {
        ficha.push(
            { text: "Fecha del incidente", style: "label" },
            { text: formatearSoloFecha(ev.reporte.fechaIncidente), style: "valor" }
        );
    }
    if (ev.textoDescifrado) {
        ficha.push(
            { text: "Lo que escribiste", style: "label" },
            { text: ev.textoDescifrado, style: "cuerpo" }
        );
    }
    if (ev.reporte?.clasificacion) {
        ficha.push(
            { text: "Clasificación del sistema", style: "label" },
            { text: clasificacionTexto(ev.reporte.clasificacion), style: "valor" }
        );
    }
    return ficha;
}

export async function generarPdfExpediente(input: PdfExpedienteInput): Promise<Buffer> {
    const {
        identificadorReportado,
        fechaApertura,
        padreEmail,
        padreNombre,
        eventosPropios,
        contextoOtros,
        fechaGeneracion,
        codigoVerificacion,
        urlVerificacion,
    } = input;

    const contenido: Content = [
        // Carátula
        { text: "EXPEDIENTE PERSONAL", style: "titulo" },
        { text: `Generado el ${formatearFecha(fechaGeneracion)}`, style: "subtitulo" },

        { text: "Datos del expediente", style: "seccion" },
        { text: "Identificador reportado", style: "label" },
        { text: identificadorReportado, style: "valor" },
        { text: "Fecha de apertura", style: "label" },
        { text: formatearSoloFecha(fechaApertura), style: "valor" },
        { text: "Titular", style: "label" },
        { text: padreNombre ? `${padreNombre} (${padreEmail})` : padreEmail, style: "valor" },

        // Eventos propios
        { text: "Mis reportes", style: "seccion", pageBreak: eventosPropios.length > 0 ? undefined : undefined },
        ...(eventosPropios.length
            ? eventosPropios.flatMap((ev) => seccionEventoPropio(ev) as Content[])
            : [{ text: "Sin eventos registrados.", style: "cuerpo" } as Content]),

        // Contexto de otros (Ley 1581: solo metadata)
        { text: "Contexto de otros reportes sobre este identificador", style: "seccion" },
        {
            text: "Los datos de terceros se muestran solo con fecha, ubicación y clasificación (Ley 1581 de Colombia).",
            style: "nota",
        },
        ...(contextoOtros.length
            ? contextoOtros.map((ctx, i): Content => ({
                ul: [
                    `Evento externo #${i + 1}: ${formatearFecha(ctx.fechaEvento)} — ` +
                        `${[ctx.reporte?.ciudad, ctx.reporte?.pais].filter(Boolean).join(", ") || "Lugar no especificado"} — ` +
                        `Clasificación: ${clasificacionTexto(ctx.reporte?.clasificacion ?? null)}`,
                ],
                margin: [0, 2, 0, 2],
            }))
            : [{ text: "No hay reportes de terceros sobre este identificador.", style: "cuerpo" } as Content]),

        // Pie
        {
            text: "Este documento es un registro personal del padre/tutor. Consérvelo como respaldo. Para denuncias formales, use los canales oficiales de las autoridades de su región.",
            style: "nota",
            margin: [0, 20, 0, 0],
        },
    ];

    const docDefinition: TDocumentDefinitions = {
        info: {
            title: `Expediente ${identificadorReportado}`,
            author: "Protección Infantil — Innovadataco",
            creationDate: fechaGeneracion,
        },
        content: contenido,
        styles: estilos,
        defaultStyle: { font: "Roboto", fontSize: 11, color: COLOR_TEXTO },
        pageMargins: [40, 60, 40, 80],
        // SPEC-340 (§4.3): pie en CADA página — fecha/hora de generación (hora
        // de Colombia) bien visible, y el código de verificación con su URL.
        footer: (currentPage, pageCount) => ({
            margin: [40, 12, 40, 0],
            columns: [
                {
                    text: [
                        `Generado el ${formatearFecha(fechaGeneracion)} (hora de Colombia)`,
                        codigoVerificacion
                            ? ` · Código de verificación: ${codigoVerificacion}${urlVerificacion ? ` · Verifícalo en ${urlVerificacion}` : ""}`
                            : "",
                    ].join(""),
                    fontSize: 8,
                    color: COLOR_TEXTO,
                },
                { text: `${currentPage} / ${pageCount}`, alignment: "right", fontSize: 8, color: COLOR_TEXTO },
            ],
        }),
    };

    return renderPdfBuffer(docDefinition);
}
