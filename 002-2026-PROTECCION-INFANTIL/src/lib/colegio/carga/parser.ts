import type { EtiquetaRelacionAlumno } from "@prisma/client";
import * as XLSX from "xlsx";

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

function normalizarHeader(header: unknown): string {
    return String(header)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
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

export interface ResultadoParser {
    filas: FilaCargaAlumno[];
    errores: ErrorFila[];
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
 * Convierte un ArrayBuffer (CSV o XLSX) a una matriz de strings.
 * Valida que existan los encabezados requeridos.
 */
export function parseArchivoCarga(arrayBuffer: ArrayBuffer, extension: "csv" | "xlsx"): ResultadoParser {
    const errores: ErrorFila[] = [];

    if (arrayBuffer.byteLength === 0) {
        errores.push({ fila: 0, campos: [], mensaje: "El archivo está vacío" });
        return { filas: [], errores };
    }

    let hoja: unknown[][];
    try {
        if (extension === "csv") {
            const text = new TextDecoder("utf-8").decode(arrayBuffer);
            hoja = parseCsvManual(text);
        } else {
            const libro = XLSX.read(new Uint8Array(arrayBuffer), {
                type: "array",
            });
            const primeraHoja = libro.SheetNames[0];
            if (!primeraHoja) {
                errores.push({ fila: 0, campos: [], mensaje: "El archivo no contiene hojas" });
                return { filas: [], errores };
            }
            hoja = XLSX.utils.sheet_to_json(libro.Sheets[primeraHoja], {
                header: 1,
                defval: "",
                blankrows: false,
                raw: true,
            }) as unknown[][];
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
