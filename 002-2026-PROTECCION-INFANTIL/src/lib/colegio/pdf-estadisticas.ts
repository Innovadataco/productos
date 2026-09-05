import type { EstadisticasColegio, EstadisticasCurso } from "./estadisticas";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";
import { renderPdfBuffer } from "@/lib/pdf/pdfmake-node";
import { armarMembreteColegio, estilosMembrete } from "./membrete-pdf";
import type {
    TDocumentDefinitions,
    Content,
    StyleDictionary,
    TableCell,
    Alignment,
} from "pdfmake/interfaces";

const COLOR_PRIMARIO = "#0b6e5a"; // = valor claro del token pino, mantener en sync
const COLOR_TEXTO = "#0f1815"; // = valor claro del token tinta, mantener en sync
const COLOR_MUTED = "#4d5552"; // = valor claro del token tinta-muted, mantener en sync
const COLOR_FONDO = "#e9f2ee"; // = tinte pino muy claro (valor claro), mantener en sync

interface EstilosPdf extends StyleDictionary {
    titulo: NonNullable<StyleDictionary["titulo"]>;
    subtitulo: NonNullable<StyleDictionary["subtitulo"]>;
    label: NonNullable<StyleDictionary["label"]>;
    valor: NonNullable<StyleDictionary["valor"]>;
    tablaHeader: NonNullable<StyleDictionary["tablaHeader"]>;
    nota: NonNullable<StyleDictionary["nota"]>;
    membreteNombre: NonNullable<StyleDictionary["membreteNombre"]>;
    membreteNit: NonNullable<StyleDictionary["membreteNit"]>;
}

const estilos: EstilosPdf = {
    // SPEC-379 (D1): membrete institucional compartido con `pdf-informe-caso`
    // vía `membrete-pdf.ts`. Sale ANTES del subtítulo estadístico.
    ...estilosMembrete,
    titulo: {
        fontSize: 22,
        bold: true,
        color: COLOR_PRIMARIO,
        margin: [0, 8, 0, 4],
    },
    subtitulo: {
        fontSize: 12,
        color: COLOR_MUTED,
        margin: [0, 0, 0, 16],
    },
    label: {
        fontSize: 10,
        color: COLOR_MUTED,
        margin: [0, 0, 0, 2],
    },
    valor: {
        fontSize: 18,
        bold: true,
        color: COLOR_TEXTO,
    },
    tablaHeader: {
        fontSize: 10,
        bold: true,
        color: "#ffffff",
        fillColor: COLOR_PRIMARIO,
        alignment: "center",
    },
    nota: {
        fontSize: 9,
        color: COLOR_MUTED,
        italics: true,
        margin: [0, 12, 0, 0],
    },
};

function formatoFechaColombia(fecha: Date): string {
    return formatoFechaHoraBogota(fecha, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Genera el PDF de estadísticas del colegio. `escudoDataUri` es el escudo ya
 * cargado (helper `leerEscudoDataUri`): pasar `null` si el colegio no lo cargó
 * — el membrete sale igual, sin imagen.
 */
export function generarPdfEstadisticas(
    datos: EstadisticasColegio,
    escudoDataUri: string | null = null
): Promise<Buffer> {
    const { colegioNombre, colegioNit, totales, porCurso } = datos;
    const fechaGeneracion = formatoFechaColombia(new Date());

    const contenido: Content[] = [
        // SPEC-379 (D1): membrete institucional — escudo (si hay) + nombre + NIT.
        ...armarMembreteColegio({ nombre: colegioNombre, nit: colegioNit, escudoDataUri }),
        {
            text: "Informe estadístico",
            style: "titulo",
        },
        {
            text: `Generado el ${fechaGeneracion}`,
            style: "subtitulo",
        },
        {
            table: {
                widths: ["*", "*", "*", "*"],
                body: [
                    [
                        { text: "Cursos", style: "tablaHeader" },
                        { text: "Alumnos", style: "tablaHeader" },
                        { text: "Identificadores", style: "tablaHeader" },
                        { text: "Alertas", style: "tablaHeader" },
                    ],
                    [
                        {
                            text: String(totales.cursos),
                            alignment: "center" as Alignment,
                            fontSize: 16,
                            bold: true,
                            color: COLOR_PRIMARIO,
                        },
                        {
                            text: String(totales.alumnos),
                            alignment: "center" as Alignment,
                            fontSize: 16,
                            bold: true,
                            color: COLOR_PRIMARIO,
                        },
                        {
                            text: String(totales.identificadores),
                            alignment: "center" as Alignment,
                            fontSize: 16,
                            bold: true,
                            color: COLOR_PRIMARIO,
                        },
                        {
                            text: String(totales.alertas),
                            alignment: "center" as Alignment,
                            fontSize: 16,
                            bold: true,
                            color: COLOR_PRIMARIO,
                        },
                    ],
                ],
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                fillColor: (rowIndex: number) => (rowIndex === 0 ? COLOR_PRIMARIO : COLOR_FONDO),
            },
            margin: [0, 0, 0, 16],
        },
        {
            text: "Desglose por curso",
            style: "subtitulo",
            margin: [0, 8, 0, 8],
        },
        construirTablaPorCurso(porCurso),
        {
            text: "Este informe solo contiene datos agregados del colegio. No incluye información personal de alumnos, identificadores ni contenido de reportes.",
            style: "nota",
        },
    ];

    const docDefinition: TDocumentDefinitions = {
        content: contenido,
        styles: estilos,
        defaultStyle: {
            font: "Roboto",
            color: COLOR_TEXTO,
        },
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

function construirTablaPorCurso(cursos: EstadisticasCurso[]): Content {
    if (cursos.length === 0) {
        return {
            text: "No hay cursos registrados en este colegio.",
            alignment: "center" as Alignment,
            color: COLOR_MUTED,
            margin: [0, 12, 0, 12],
        };
    }

    const header: TableCell[] = [
        { text: "Curso", style: "tablaHeader" },
        { text: "Grado", style: "tablaHeader" },
        { text: "Alumnos", style: "tablaHeader" },
        { text: "Identificadores", style: "tablaHeader" },
        { text: "Alertas", style: "tablaHeader" },
    ];

    const body: TableCell[][] = cursos.map((curso) => [
        curso.nombre,
        curso.grado ?? "—",
        { text: String(curso.alumnos), alignment: "center" as Alignment } as TableCell,
        { text: String(curso.identificadores), alignment: "center" as Alignment } as TableCell,
        { text: String(curso.alertas), alignment: "center" as Alignment } as TableCell,
    ]);

    return {
        table: {
            widths: ["*", "auto", "auto", "auto", "auto"],
            body: [header, ...body],
        },
        layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
            vLineWidth: () => 0.5,
            hLineColor: () => "#dfe3e1",
            vLineColor: () => "#dfe3e1",
            fillColor: (rowIndex: number) =>
                rowIndex === 0 ? COLOR_PRIMARIO : rowIndex % 2 === 0 ? "#f9fafb" : null,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
        },
    };
}
