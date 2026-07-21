import type { EstadisticasColegio, EstadisticasCurso } from "./estadisticas";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type {
    TDocumentDefinitions,
    Content,
    StyleDictionary,
    TableCell,
    Alignment,
} from "pdfmake/interfaces";

// pdfmake requiere registrar las fuentes virtuales en Node
(pdfMake as unknown as { vfs: Record<string, string> }).vfs = (pdfFonts as unknown as { vfs: Record<string, string> }).vfs;

const COLOR_PRIMARIO = "#10b981"; // emerald-500
const COLOR_TEXTO = "#1f2937"; // gray-800
const COLOR_MUTED = "#6b7280"; // gray-500
const COLOR_FONDO = "#f0fdf4"; // emerald-50

interface EstilosPdf extends StyleDictionary {
    titulo: NonNullable<StyleDictionary["titulo"]>;
    subtitulo: NonNullable<StyleDictionary["subtitulo"]>;
    label: NonNullable<StyleDictionary["label"]>;
    valor: NonNullable<StyleDictionary["valor"]>;
    tablaHeader: NonNullable<StyleDictionary["tablaHeader"]>;
    nota: NonNullable<StyleDictionary["nota"]>;
}

const estilos: EstilosPdf = {
    titulo: {
        fontSize: 22,
        bold: true,
        color: COLOR_PRIMARIO,
        margin: [0, 0, 0, 4],
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
    return fecha.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function generarPdfEstadisticas(datos: EstadisticasColegio): Promise<Buffer> {
    const { colegioNombre, totales, porCurso } = datos;
    const fechaGeneracion = formatoFechaColombia(new Date());

    const contenido: Content[] = [
        {
            text: colegioNombre,
            style: "titulo",
        },
        {
            text: `Informe estadístico · Generado el ${fechaGeneracion}`,
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

    return (((pdfMake as unknown as { createPdf: (...args: unknown[]) => { getBuffer: () => Promise<Buffer> } }).createPdf(
        docDefinition,
        undefined,
        undefined,
        (pdfFonts as unknown as { vfs: Record<string, string> }).vfs
    ).getBuffer()) as Promise<Buffer>);
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
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
            fillColor: (rowIndex: number) =>
                rowIndex === 0 ? COLOR_PRIMARIO : rowIndex % 2 === 0 ? "#f9fafb" : null,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
        },
    };
}
