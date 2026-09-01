/**
 * SPEC-344 (A-69 · C1 · D-5) — Parser de la carga por Excel de profesores.
 *
 * Fresco contra `main` actual con suite completa (matiz CEO 03:18). El commit
 * `bc49277fc` de SPEC-335 se leyó como referencia de columnas y forma; el
 * código NO se copió (regla 15v5, canonicidad E-1: código ajeno = leído
 * línea por línea antes de traerlo).
 *
 * Soporta CSV y XLSX (exceljs, mismo motor que el parser de alumnos). Los
 * límites (5 MB, 2000 filas) se leen de `ParametroSistema` con fallback.
 */
import ExcelJS from "exceljs";
import { getParametroSistema } from "@/lib/parametros";

/** Columnas obligatorias del validador. Fuente única — la plantilla las emite. */
export const COLUMNAS_PROFESOR = [
    "nombre",
    "apellidos",
    "tipo_documento",
    "numero_documento",
    "anio_nacimiento",
    "sexo",
    "email",
    "telefono",
] as const;

export type ColumnaProfesor = (typeof COLUMNAS_PROFESOR)[number];

export interface FilaProfesor {
    lineaOriginal: number;
    nombre: string;
    apellidos: string;
    tipo_documento: string;
    numero_documento: string;
    anio_nacimiento: string;
    sexo: string;
    email: string;
    telefono: string;
}

export interface ErrorParser {
    linea: number;
    columna?: string;
    mensaje: string;
}

export interface ResultadoParserProfesores {
    filas: FilaProfesor[];
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

/** Parsea el buffer (CSV o XLSX). No valida contenido; solo estructura. */
export async function parseArchivoCargaProfesores(
    buffer: ArrayBuffer,
    extension: "csv" | "xlsx",
): Promise<ResultadoParserProfesores> {
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

    const faltantes = COLUMNAS_PROFESOR.filter((c) => !idx.has(c));
    if (faltantes.length > 0) {
        errores.push({
            linea: 0,
            columna: faltantes[0],
            mensaje: `Faltan columnas obligatorias: ${faltantes.join(", ")}.`,
        });
        return { filas: [], errores };
    }

    const filas: FilaProfesor[] = [];
    for (let i = 1; i < matriz.length; i++) {
        const rawFila = matriz[i] ?? [];
        const obj: FilaProfesor = {
            lineaOriginal: i + 1,
            nombre: celda(rawFila[idx.get("nombre")!]),
            apellidos: celda(rawFila[idx.get("apellidos")!]),
            tipo_documento: celda(rawFila[idx.get("tipo_documento")!]),
            numero_documento: celda(rawFila[idx.get("numero_documento")!]),
            anio_nacimiento: celda(rawFila[idx.get("anio_nacimiento")!]),
            sexo: celda(rawFila[idx.get("sexo")!]),
            email: celda(rawFila[idx.get("email")!]),
            telefono: celda(rawFila[idx.get("telefono")!]),
        };
        filas.push(obj);
    }

    return { filas, errores };
}

/**
 * Cadena CSV oficial de la plantilla. Incluye TODAS las columnas obligatorias
 * + una fila de ejemplo válida. FR-026-bis: un test-candado la consume y la
 * pasa por el validator para asegurar que la fila de ejemplo es válida
 * (cierra I-245 para profesores; aplica el mismo patrón a alumnos).
 */
export const PLANTILLA_PROFESORES_CSV: string =
    COLUMNAS_PROFESOR.join(",") +
    "\n" +
    [
        "Andrés Felipe",
        "Mora Ramírez",
        "CC",
        "80114552",
        "1985",
        "M",
        "amora@sagrado.edu.co",
        "+573152201144",
    ]
        .map((v) => (v.includes(",") ? `"${v}"` : v))
        .join(",") +
    "\n";
