/**
 * SPEC-140 (N-4, FR-006/FR-007): expediente forense para autoridades.
 * Lista CERRADA de campos autorizados — se construye por whitelist (nunca spread
 * del modelo), de modo que un campo nuevo del modelo NO se filtre por defecto.
 * EXCLUIDOS SIEMPRE: identidad del denunciante (`usuarioId`, email, nombre), IP,
 * huella anti-abuso (`fuenteConfianza`, ipHash, fingerprintHash), texto y
 * textoOriginal del reporte, datos de sesión y tenant del colegio.
 * El PDF sigue las mismas reglas que la denuncia (D-23: plantilla determinista,
 * nunca IA; la plataforma NO lo retiene; `info.creationDate` fija = salida
 * determinista).
 */
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import type {
    TDocumentDefinitions,
    Content,
    StyleDictionary,
    Alignment,
} from "pdfmake/interfaces";
import type { ReporteExpediente } from "./expediente";
import { plantillasDenunciaUnicas } from "./pdf-denuncia";

const COLOR_PRIMARIO = "#1d4ed8"; // blue-700
const COLOR_TEXTO = "#1f2937"; // gray-800
const COLOR_MUTED = "#6b7280"; // gray-500

const estilos: StyleDictionary = {
    titulo: { fontSize: 18, bold: true, color: COLOR_PRIMARIO, margin: [0, 0, 0, 4] },
    subtitulo: { fontSize: 11, color: COLOR_MUTED, margin: [0, 0, 0, 12] },
    seccion: { fontSize: 13, bold: true, color: COLOR_TEXTO, margin: [0, 10, 0, 6] },
    label: { fontSize: 9, color: COLOR_MUTED, margin: [0, 0, 0, 1] },
    valor: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    cuerpo: { fontSize: 11, color: COLOR_TEXTO, margin: [0, 0, 0, 6] },
    nota: { fontSize: 9, color: COLOR_MUTED, italics: true, margin: [0, 10, 0, 0] },
};

export interface TransicionForense {
    estadoAnterior: string;
    estadoNuevo: string;
    responsableTipo: string;
    creadoEn: string;
}

/** Vista forense del expediente: SOLO los campos autorizados (lista cerrada). */
export interface ExpedienteForense {
    identificador: string;
    plataforma: string;
    fechaIncidente: string;
    ciudad: string;
    pais: string;
    /** Origen del reporte sin identidad: "anónimo" o "cuenta registrada". */
    origen: string;
    estadoActual: string;
    conductas: string[];
    descripcionConductas: string[];
    traza: TransicionForense[];
    conteoReportesIdentificador: number | null;
    creadoEn: string;
}

/** Conductas confirmadas: categoría principal + secundarias (dedup, orden estable). */
export function extraerConductas(clasificacion: ReporteExpediente["clasificacion"]): string[] {
    if (!clasificacion) return [];
    const secundarias = Array.isArray(clasificacion.categoriasSecundarias)
        ? clasificacion.categoriasSecundarias
        : [];
    const extras = secundarias
        .map((s) => (typeof s === "object" && s !== null && "categoria" in s ? (s as { categoria: unknown }).categoria : null))
        .filter((x): x is string => typeof x === "string");
    return [...new Set([clasificacion.categoria, ...extras])];
}

/**
 * Arma la vista forense por WHITELIST (FR-006): solo los campos autorizados.
 * `conteoReportesIdentificador` es el agregado público de IdentificadorReportado
 * (null si el identificador aún no tiene agregado).
 */
export function armarExpedienteForense(
    reporte: ReporteExpediente,
    conteoReportesIdentificador: number | null
): ExpedienteForense {
    const conductas = extraerConductas(reporte.clasificacion);
    // Sin conductas confirmadas no se describe ninguna (la genérica es solo para
    // la denuncia, donde siempre hay clasificación — gate de estado en el endpoint).
    const descripcionConductas =
        conductas.length > 0
            ? plantillasDenunciaUnicas(conductas).map((p) => `Se registraron reportes que describen ${p.hecho}.`)
            : [];
    return {
        identificador: reporte.identificador,
        plataforma: reporte.plataforma.nombre,
        fechaIncidente: reporte.fechaIncidente.toISOString(),
        ciudad: reporte.ciudad,
        pais: reporte.pais,
        origen: reporte.esAnonimo ? "anónimo" : "cuenta registrada",
        estadoActual: reporte.estado,
        conductas,
        descripcionConductas,
        traza: reporte.transiciones.map((t) => ({
            estadoAnterior: t.estadoAnterior,
            estadoNuevo: t.estadoNuevo,
            responsableTipo: t.responsableTipo,
            creadoEn: t.creadoEn.toISOString(),
        })),
        conteoReportesIdentificador,
        creadoEn: reporte.creadoEn.toISOString(),
    };
}

function formatoFechaColombia(fechaIso: string): string {
    return new Date(fechaIso).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function campo(label: string, valor: string): Content {
    return {
        columns: [
            { width: 160, text: label, style: "label" },
            { width: "*", text: valor, style: "valor" },
        ],
    };
}

/** Genera el PDF del expediente forense en memoria. La plataforma NO lo retiene. */
export function generarPdfForense(exp: ExpedienteForense, fechaGeneracion: Date): Promise<Buffer> {
    const contenido: Content[] = [
        { text: "Expediente forense del reporte", style: "titulo" },
        {
            text: `Insumo estructurado para autoridades de protección · Generado el ${formatoFechaColombia(fechaGeneracion.toISOString())}`,
            style: "subtitulo",
        },
        { text: "Datos autorizados del reporte", style: "seccion" },
        campo("Identificador reportado", exp.identificador),
        campo("Plataforma", exp.plataforma),
        campo("Fecha del incidente", formatoFechaColombia(exp.fechaIncidente)),
        campo("Ubicación", `${exp.ciudad}, ${exp.pais}`),
        campo("Origen del reporte", exp.origen),
        campo("Estado actual", exp.estadoActual.replace(/_/g, " ")),
        campo(
            "Reportes registrados del identificador",
            exp.conteoReportesIdentificador === null
                ? "Sin agregado disponible"
                : `${exp.conteoReportesIdentificador} reportes registrados`
        ),
        { text: "Conductas descritas en los reportes", style: "seccion" },
        ...(exp.descripcionConductas.length > 0
            ? exp.descripcionConductas.map((d): Content => ({ text: d, style: "cuerpo" }))
            : [{ text: "Sin conductas confirmadas registradas.", style: "cuerpo" } as Content]),
        { text: "Traza de estados", style: "seccion" },
        ...(exp.traza.length > 0
            ? exp.traza.map(
                (t): Content => ({
                    text: `${t.estadoAnterior.replace(/_/g, " ")} → ${t.estadoNuevo.replace(/_/g, " ")} · ${t.responsableTipo} · ${formatoFechaColombia(t.creadoEn)}`,
                    style: "cuerpo",
                })
            )
            : [{ text: "Sin transiciones registradas.", style: "cuerpo" } as Content]),
        {
            text: "Este documento describe reportes registrados por la comunidad en la plataforma. No constituye un veredicto ni una determinación de responsabilidad sobre persona alguna.",
            style: "nota",
        },
        {
            text: "La plataforma no retiene este documento. No incluye la identidad de quienes reportaron ni el contenido de los reportes.",
            style: "nota",
        },
    ];

    const docDefinition: TDocumentDefinitions = {
        info: {
            title: "Expediente forense del reporte",
            author: "Plataforma comunitaria de protección infantil",
            subject: "Insumo estructurado para autoridades de protección",
            creationDate: fechaGeneracion,
        },
        content: contenido,
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

    return renderPdfBuffer(docDefinition);
}
