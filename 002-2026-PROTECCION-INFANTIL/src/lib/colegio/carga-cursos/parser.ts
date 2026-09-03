/**
 * SPEC-379 (PR B · D5a) — Parser de la carga por Excel de CURSOS.
 *
 * Sigue exactamente el patrón de `carga-profesores/parser.ts`: CSV o XLSX,
 * límites de tamaño y filas por `ParametroSistema` con fallback, headers
 * normalizados sin acentos, y una constante `PLANTILLA_CURSOS_CSV` que emite
 * la plantilla oficial. Un test-candado (`plantilla-autoconsistente.test.ts`)
 * pasa la plantilla por su propio validador — cierra I-245 para cursos.
 */
import ExcelJS from "exceljs";
import { getParametroSistema } from "@/lib/parametros";

/** Columnas obligatorias del validador. Fuente única — la plantilla las emite. */
export const COLUMNAS_CURSO_REQUERIDAS = ["nombre"] as const;
/** Columnas opcionales aceptadas por el parser (se propagan al validador). */
export const COLUMNAS_CURSO_OPCIONALES = [
    "grado",
    "anio_lectivo",
    "profesor_titular_documento",
] as const;

export const COLUMNAS_CURSO = [
    ...COLUMNAS_CURSO_REQUERIDAS,
    ...COLUMNAS_CURSO_OPCIONALES,
] as const;

export type ColumnaCurso = (typeof COLUMNAS_CURSO)[number];

export interface FilaCurso {
    lineaOriginal: number;
    nombre: string;
    grado: string;
    anio_lectivo: string;
    profesor_titular_documento: string;
}

export interface ErrorParser {
    linea: number;
    columna?: string;
    mensaje: string;
}

export interface ResultadoParserCursos {
    filas: FilaCurso[];
    errores: ErrorParser[];
}

const MAX_BYTES_DEFAULT = 5 * 1024 * 1024;
const MAX_FILAS_DEFAULT = 2000;

function normalizarHeader(h: unknown): string {
    return String(h ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "_");
}

function celda(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object") {
        const o = v as { text?: unknown; richText?: Array<{ text: string }>; result?: unknown };
        if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
        if (o.text !== undefined) return String(o.text).trim();
        if (o.result !== undefined) return String(o.result).trim();
        return "";
    }
    return String(v).trim();
}

/** Parser CSV manual con manejo de comillas y `""` como escape. */
function parseCsv(text: string): string[][] {
    const filas: string[][] = [];
    let fila: string[] = [];
    let celdaBuf = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const n = text[i + 1];
        if (inQuotes) {
            if (c === '"' && n === '"') { celdaBuf += '"'; i++; continue; }
            if (c === '"') { inQuotes = false; continue; }
            celdaBuf += c; continue;
        }
        if (c === '"') { inQuotes = true; continue; }
        if (c === ",") { fila.push(celdaBuf); celdaBuf = ""; continue; }
        if (c === "\n") { fila.push(celdaBuf); filas.push(fila); fila = []; celdaBuf = ""; continue; }
        if (c === "\r") { if (n === "\n") i++; fila.push(celdaBuf); filas.push(fila); fila = []; celdaBuf = ""; continue; }
        celdaBuf += c;
    }
    if (celdaBuf !== "" || fila.length > 0) { fila.push(celdaBuf); filas.push(fila); }
    return filas.filter((f) => f.some((v) => v !== ""));
}

export async function parseArchivoCargaCursos(
    buffer: ArrayBuffer,
    extension: "csv" | "xlsx",
): Promise<ResultadoParserCursos> {
    const errores: ErrorParser[] = [];

    if (buffer.byteLength === 0) {
        errores.push({ linea: 0, mensaje: "El archivo está vacío." });
        return { filas: [], errores };
    }

    const paramBytes = await getParametroSistema("carga.max_archivo_bytes");
    const maxBytes = parseInt(paramBytes?.valor ?? String(MAX_BYTES_DEFAULT), 10);
    const paramFilas = await getParametroSistema("colegio.carga.max_filas");
    const maxFilas = parseInt(paramFilas?.valor ?? String(MAX_FILAS_DEFAULT), 10);

    if (buffer.byteLength > maxBytes) {
        errores.push({
            linea: 0,
            mensaje: `El archivo supera el tamaño máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB).`,
        });
        return { filas: [], errores };
    }

    let matriz: unknown[][];
    try {
        if (extension === "csv") {
            const bom = "﻿";
            let text = new TextDecoder("utf-8").decode(buffer);
            if (text.startsWith(bom)) text = text.slice(1);
            matriz = parseCsv(text);
        } else {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buffer);
            const hoja = wb.worksheets[0];
            if (!hoja) {
                errores.push({ linea: 0, mensaje: "El archivo no contiene hojas." });
                return { filas: [], errores };
            }
            matriz = [];
            hoja.eachRow({ includeEmpty: false }, (row) => {
                const valores = (row.values as unknown[]).slice(1);
                if (valores.some((v) => celda(v) !== "")) matriz.push(valores);
            });
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        errores.push({ linea: 0, mensaje: `No se pudo leer el archivo: ${msg}` });
        return { filas: [], errores };
    }

    if (matriz.length === 0) {
        errores.push({ linea: 0, mensaje: "El archivo no contiene filas." });
        return { filas: [], errores };
    }

    if (matriz.length - 1 > maxFilas) {
        errores.push({
            linea: 0,
            mensaje: `El archivo tiene más filas de las permitidas (máximo ${maxFilas}).`,
        });
        return { filas: [], errores };
    }

    const headers = (matriz[0] ?? []).map((h) => normalizarHeader(h));
    const idx = new Map<string, number>();
    headers.forEach((h, i) => idx.set(h, i));

    const faltantes = COLUMNAS_CURSO_REQUERIDAS.filter((c) => !idx.has(c));
    if (faltantes.length > 0) {
        errores.push({
            linea: 0,
            columna: faltantes[0],
            mensaje: `Faltan columnas obligatorias: ${faltantes.join(", ")}.`,
        });
        return { filas: [], errores };
    }

    const filas: FilaCurso[] = [];
    for (let i = 1; i < matriz.length; i++) {
        const rawFila = matriz[i] ?? [];
        const obj: FilaCurso = {
            lineaOriginal: i + 1,
            nombre: celda(rawFila[idx.get("nombre")!]),
            grado: idx.has("grado") ? celda(rawFila[idx.get("grado")!]) : "",
            anio_lectivo: idx.has("anio_lectivo") ? celda(rawFila[idx.get("anio_lectivo")!]) : "",
            profesor_titular_documento: idx.has("profesor_titular_documento")
                ? celda(rawFila[idx.get("profesor_titular_documento")!])
                : "",
        };
        filas.push(obj);
    }

    return { filas, errores };
}

/**
 * Plantilla oficial. Trae TODAS las columnas (requeridas + opcionales) y una
 * fila de ejemplo válida. El candado I-245 aplicado a cursos: el
 * test-autoconsistente pasa esta cadena por el parser + validator y afirma
 * `crear:1, omitidos:0, errores:0` para que la plantilla no se desincronice.
 */
export const PLANTILLA_CURSOS_CSV: string =
    COLUMNAS_CURSO.join(",") +
    "\n" +
    ["6A - Ciencias", "6", "2026", ""]
        .map((v) => (v.includes(",") ? `"${v}"` : v))
        .join(",") +
    "\n";
