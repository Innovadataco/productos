import ExcelJS from "exceljs";
import type { EtiquetaRelacionAlumno } from "@prisma/client";
import { getParametroSistema } from "@/lib/parametros";

export type FilaCargaAlumno = {
    fila: number;
    curso: {
        nombre: string;
        grado: string | null;
        anioLectivo: string | null;
    };
    alumno: {
        nombre: string;
    };
    identificador: {
        tipo: string;
        valor: string;
        etiquetaRelacion: EtiquetaRelacionAlumno;
        plataformaId: string | null;
    };
};

export type ErrorFila = {
    fila: number;
    campos: string[];
    mensaje: string;
};

export const COLUMNAS_REQUERIDAS = [
    "nombre_curso",
    "grado",
    "anio_lectivo",
    "nombre_alumno",
    "tipo_identificador",
    "valor_identificador",
    "etiqueta_relacion",
    "plataforma",
];

// SPEC-132 (S-3): límites explícitos de la carga (parámetros con fallback).
const MAX_ARCHIVO_BYTES_DEFAULT = 5 * 1024 * 1024; // 5 MB
const MAX_FILAS_DEFAULT = 2000;

function normalizarHeader(header: unknown): string {
    return String(header)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "_");
}

function celdaAString(valor: unknown): string {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "string") return valor;
    return String(valor).trim();
}

function filaAMatrizStrings(fila: unknown[]): string[] {
    return fila.map(celdaAString);
}

function parseCsvManual(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    cell += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ",") {
                row.push(cell);
                cell = "";
            } else if (char === "\n") {
                row.push(cell);
                rows.push(row);
                row = [];
                cell = "";
            } else if (char === "\r") {
                if (nextChar === "\n") {
                    i++;
                }
                row.push(cell);
                rows.push(row);
                row = [];
                cell = "";
            } else {
                cell += char;
            }
        }
        i++;
    }
    if (cell !== "" || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

/**
 * Valor crudo de una celda exceljs, equivalente al `raw: true` de SheetJS que usaba
 * el parser original (SPEC-132 S-3/O-1: misma semántica para no mover fixtures).
 */
function valorCeldaExceljs(valor: ExcelJS.CellValue): unknown {
    if (valor === null || valor === undefined) return "";
    if (valor instanceof Date) return valor;
    if (typeof valor === "object") {
        const obj = valor as { text?: unknown; richText?: Array<{ text: string }>; result?: unknown; hyperlink?: unknown };
        if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join("");
        if (obj.text !== undefined) return obj.text;
        if (obj.result !== undefined) return obj.result;
        if (obj.hyperlink !== undefined && obj.text !== undefined) return obj.text;
        return "";
    }
    return valor;
}

export interface ResultadoParser {
    filas: FilaCargaAlumno[];
    errores: ErrorFila[];
}

/**
 * Convierte un ArrayBuffer (CSV o XLSX) a una matriz de strings.
 * Valida límites de tamaño/filas y que existan los encabezados requeridos.
 * SPEC-132 (S-3): XLSX se lee con exceljs (la librería xlsx tenía CVEs y se retiró).
 */
export async function parseArchivoCarga(arrayBuffer: ArrayBuffer, extension: "csv" | "xlsx"): Promise<ResultadoParser> {
    const errores: ErrorFila[] = [];

    if (arrayBuffer.byteLength === 0) {
        errores.push({ fila: 0, campos: [], mensaje: "El archivo está vacío" });
        return { filas: [], errores };
    }

    // SPEC-132 (S-3): límites explícitos (misma clave que la ruta + tope de bytes).
    const paramMaxBytes = await getParametroSistema("carga.max_archivo_bytes");
    const maxBytes = parseInt(paramMaxBytes?.valor ?? String(MAX_ARCHIVO_BYTES_DEFAULT), 10);
    const paramMaxFilas = await getParametroSistema("colegio.carga.max_filas");
    const maxFilas = parseInt(paramMaxFilas?.valor ?? String(MAX_FILAS_DEFAULT), 10);

    if (arrayBuffer.byteLength > maxBytes) {
        errores.push({
            fila: 0,
            campos: [],
            mensaje: `El archivo supera el tamaño máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB)`,
        });
        return { filas: [], errores };
    }

    let hoja: unknown[][];
    try {
        if (extension === "csv") {
            const text = new TextDecoder("utf-8").decode(arrayBuffer);
            hoja = parseCsvManual(text);
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                errores.push({ fila: 0, campos: [], mensaje: "El archivo no contiene hojas" });
                return { filas: [], errores };
            }
            hoja = [];
            worksheet.eachRow({ includeEmpty: false }, (row) => {
                const valores = (row.values as unknown[]).slice(1).map((v) => valorCeldaExceljs(v as ExcelJS.CellValue));
                hoja.push(valores);
            });
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        errores.push({ fila: 0, campos: [], mensaje: `No se pudo leer el archivo: ${msg}` });
        return { filas: [], errores };
    }

    if (hoja.length === 0) {
        errores.push({ fila: 0, campos: [], mensaje: "El archivo no contiene filas" });
        return { filas: [], errores };
    }

    // SPEC-132 (S-3): límite de filas (el encabezado no cuenta).
    if (hoja.length - 1 > maxFilas) {
        errores.push({
            fila: 0,
            campos: [],
            mensaje: `El archivo tiene más filas de las permitidas (máximo ${maxFilas})`,
        });
        return { filas: [], errores };
    }

    const headersRaw = hoja[0] ?? [];
    const headers = filaAMatrizStrings(headersRaw).map(normalizarHeader);
    const indices = new Map<string, number>();
    for (const columna of COLUMNAS_REQUERIDAS) {
        const idx = headers.indexOf(columna);
        if (idx === -1) {
            errores.push({ fila: 1, campos: ["encabezados"], mensaje: `Columna requerida faltante: ${columna}` });
        } else {
            indices.set(columna, idx);
        }
    }

    if (errores.length > 0) {
        return { filas: [], errores };
    }

    const filas: FilaCargaAlumno[] = [];

    for (let i = 1; i < hoja.length; i++) {
        const raw = hoja[i] ?? [];
        const fila = filaAMatrizStrings(raw);
        // Ignorar filas completamente vacías.
        if (fila.every((celda) => celda === "")) continue;

        const nombreCurso = fila[indices.get("nombre_curso")!]?.trim() ?? "";
        const grado = fila[indices.get("grado")!]?.trim() ?? "";
        const anioLectivo = fila[indices.get("anio_lectivo")!]?.trim() ?? "";
        const nombreAlumno = fila[indices.get("nombre_alumno")!]?.trim() ?? "";
        const tipoIdentificador = fila[indices.get("tipo_identificador")!]?.trim() ?? "";
        const valorIdentificador = fila[indices.get("valor_identificador")!]?.trim() ?? "";
        const etiquetaRelacion = fila[indices.get("etiqueta_relacion")!]?.trim() ?? "";
        const plataforma = fila[indices.get("plataforma")!]?.trim() ?? "";

        const etiquetaNormalizada = (etiquetaRelacion.toUpperCase() || "ALUMNO") as EtiquetaRelacionAlumno;

        filas.push({
            fila: i + 1, // número de fila en el archivo (1-based, fila 1 = encabezado)
            curso: {
                nombre: nombreCurso,
                grado: grado || null,
                anioLectivo: anioLectivo || null,
            },
            alumno: {
                nombre: nombreAlumno,
            },
            identificador: {
                tipo: tipoIdentificador,
                valor: valorIdentificador,
                etiquetaRelacion: etiquetaNormalizada,
                plataformaId: plataforma || null,
            },
        });
    }

    if (filas.length === 0) {
        errores.push({ fila: 0, campos: [], mensaje: "El archivo solo contiene encabezados" });
    }

    return { filas, errores };
}
