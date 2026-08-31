/**
 * SPEC-335: parseo del archivo de carga masiva de PROFESORES (CSV/XLSX).
 * Mismo enfoque que la carga de alumnos (`../carga/parser.ts`), con su propio
 * juego de columnas. No modifica el flujo de alumnos.
 */
import ExcelJS from "exceljs";
import { getParametroSistema } from "@/lib/parametros";

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

export type FilaCargaProfesor = {
    /** Número de fila en el archivo (1 = encabezado), para reportar al rector. */
    fila: number;
    nombre: string;
    apellidos: string;
    tipoDocumento: string;
    numeroDocumento: string;
    anioNacimiento: string;
    sexo: string;
    email: string;
    telefono: string;
};

export type ErrorArchivo = { fila: number; mensaje: string };

export interface ResultadoParserProfesores {
    filas: FilaCargaProfesor[];
    errores: ErrorArchivo[];
}

const MAX_ARCHIVO_BYTES_DEFAULT = 5 * 1024 * 1024; // 5 MB
const MAX_FILAS_DEFAULT = 2000;

function normalizarHeader(header: unknown): string {
    return String(header ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "_");
}

function valorCelda(valor: ExcelJS.CellValue): string {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "object") {
        const obj = valor as { text?: string; result?: unknown; richText?: { text: string }[] };
        if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("");
        if (typeof obj.text === "string") return obj.text;
        if (obj.result !== undefined) return String(obj.result);
        if (valor instanceof Date) return valor.toISOString().slice(0, 10);
        return "";
    }
    return String(valor);
}

/** CSV simple con soporte de comillas dobles (mismo criterio que la carga de alumnos). */
function parseCsvManual(text: string): string[][] {
    const filas: string[][] = [];
    let campo = "";
    let fila: string[] = [];
    let enComillas = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (enComillas) {
            if (c === '"' && text[i + 1] === '"') { campo += '"'; i++; }
            else if (c === '"') enComillas = false;
            else campo += c;
            continue;
        }
        if (c === '"') enComillas = true;
        else if (c === ",") { fila.push(campo); campo = ""; }
        else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
        else if (c !== "\r") campo += c;
    }
    if (campo.length > 0 || fila.length > 0) { fila.push(campo); filas.push(fila); }
    return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

export async function parseArchivoProfesores(
    arrayBuffer: ArrayBuffer,
    extension: "csv" | "xlsx"
): Promise<ResultadoParserProfesores> {
    const errores: ErrorArchivo[] = [];

    if (arrayBuffer.byteLength === 0) {
        return { filas: [], errores: [{ fila: 0, mensaje: "El archivo está vacío" }] };
    }

    const paramMaxBytes = await getParametroSistema("carga.max_archivo_bytes");
    const maxBytes = parseInt(paramMaxBytes?.valor ?? String(MAX_ARCHIVO_BYTES_DEFAULT), 10);
    const paramMaxFilas = await getParametroSistema("colegio.carga.max_filas");
    const maxFilas = parseInt(paramMaxFilas?.valor ?? String(MAX_FILAS_DEFAULT), 10);

    if (arrayBuffer.byteLength > maxBytes) {
        return {
            filas: [],
            errores: [{ fila: 0, mensaje: `El archivo supera el tamaño máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB)` }],
        };
    }

    let hoja: string[][];
    try {
        if (extension === "csv") {
            hoja = parseCsvManual(new TextDecoder("utf-8").decode(arrayBuffer));
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                return { filas: [], errores: [{ fila: 0, mensaje: "El archivo no contiene hojas" }] };
            }
            hoja = [];
            worksheet.eachRow({ includeEmpty: false }, (row) => {
                const valores = (row.values as unknown[]).slice(1).map((v) => valorCelda(v as ExcelJS.CellValue));
                hoja.push(valores);
            });
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        return { filas: [], errores: [{ fila: 0, mensaje: `No se pudo leer el archivo: ${msg}` }] };
    }

    if (hoja.length === 0) {
        return { filas: [], errores: [{ fila: 0, mensaje: "El archivo no contiene filas" }] };
    }

    const headers = (hoja[0] ?? []).map(normalizarHeader);
    const faltantes = COLUMNAS_PROFESOR.filter((c) => !headers.includes(c));
    if (faltantes.length > 0) {
        return {
            filas: [],
            errores: [{ fila: 1, mensaje: `Faltan columnas obligatorias: ${faltantes.join(", ")}` }],
        };
    }

    const idx = Object.fromEntries(COLUMNAS_PROFESOR.map((c) => [c, headers.indexOf(c)])) as Record<
        (typeof COLUMNAS_PROFESOR)[number],
        number
    >;

    const filas: FilaCargaProfesor[] = [];
    const cuerpo = hoja.slice(1);
    if (cuerpo.length > maxFilas) {
        return { filas: [], errores: [{ fila: 0, mensaje: `El archivo supera el máximo de ${maxFilas} filas` }] };
    }

    cuerpo.forEach((raw, i) => {
        const get = (c: (typeof COLUMNAS_PROFESOR)[number]) => String(raw[idx[c]] ?? "").trim();
        filas.push({
            fila: i + 2, // 1 = encabezado
            nombre: get("nombre"),
            apellidos: get("apellidos"),
            tipoDocumento: get("tipo_documento"),
            numeroDocumento: get("numero_documento"),
            anioNacimiento: get("anio_nacimiento"),
            sexo: get("sexo"),
            email: get("email"),
            telefono: get("telefono"),
        });
    });

    return { filas, errores };
}
