import { z } from "zod";
import { casoSimulacionSchema, type CasoSimulacion } from "@/lib/schemas/simulacion";

export interface CasoValidado {
    indice: number;
    caso: CasoSimulacion;
}

export interface ErrorValidacion {
    indice: number;
    campo?: string;
    mensaje: string;
}

export interface ResultadoParseo {
    ok: boolean;
    casos?: CasoValidado[];
    errores?: ErrorValidacion[];
    mensaje?: string;
}

const CAMPOS_REQUERIDOS_CSV = ["texto", "plataforma", "identificador", "fechaIncidente", "ciudad", "pais"];
const CAMPOS_OPCIONALES_CSV = ["edadVictima", "categoriaEsperada"];
const TODOS_LOS_CAMPOS_CSV = [...CAMPOS_REQUERIDOS_CSV, ...CAMPOS_OPCIONALES_CSV];

function normalizarEdad(raw: unknown): unknown {
    if (raw === "" || raw === undefined || raw === null) return undefined;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed === "") return undefined;
        const num = Number(trimmed);
        return Number.isNaN(num) ? raw : num;
    }
    return raw;
}

function preprocesarCaso(raw: Record<string, unknown>): Record<string, unknown> {
    const copia = { ...raw };
    if ("edadVictima" in copia) {
        copia.edadVictima = normalizarEdad(copia.edadVictima);
    }
    return copia;
}

function validarCaso(raw: unknown, indice: number): { caso?: CasoSimulacion; error?: ErrorValidacion } {
    const parsed = casoSimulacionSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
            error: {
                indice,
                campo: first.path.join("."),
                mensaje: first.message,
            },
        };
    }
    return { caso: parsed.data };
}

function trimQuotes(valor: string | undefined): string {
    return (valor ?? "").trim().replace(/^["']|["']$/g, "");
}

function csvTieneCabeceraRequerida(cabecera: string[]): { ok: boolean; mensaje: string } {
    const faltantes = CAMPOS_REQUERIDOS_CSV.filter((campo) => !cabecera.some((c) => c.toLowerCase() === campo.toLowerCase()));
    if (faltantes.length > 0) {
        return {
            ok: false,
            mensaje: `CSV debe tener columnas ${CAMPOS_REQUERIDOS_CSV.join(", ")} (y opcional ${CAMPOS_OPCIONALES_CSV.join(", ")}). Faltan: ${faltantes.join(", ")}`,
        };
    }
    return { ok: true, mensaje: "" };
}

function indiceColumna(cabecera: string[], nombre: string): number {
    return cabecera.findIndex((c) => c.toLowerCase() === nombre.toLowerCase());
}

export function parsearCSV(contenido: string): ResultadoParseo {
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length === 0) {
        return { ok: false, mensaje: "El archivo no contiene casos" };
    }

    const cabecera = lineas[0].split(",").map((c) => c.trim());
    const cabeceraCheck = csvTieneCabeceraRequerida(cabecera);
    if (!cabeceraCheck.ok) {
        return { ok: false, mensaje: cabeceraCheck.mensaje };
    }

    const indices: Record<string, number> = {};
    for (const campo of TODOS_LOS_CAMPOS_CSV) {
        const idx = indiceColumna(cabecera, campo);
        if (idx !== -1) indices[campo] = idx;
    }

    const casos: CasoValidado[] = [];
    const errores: ErrorValidacion[] = [];

    for (let i = 1; i < lineas.length; i++) {
        const celdas = lineas[i].split(",");
        const raw: Record<string, unknown> = {};
        for (const [campo, idx] of Object.entries(indices)) {
            raw[campo] = trimQuotes(celdas[idx]);
        }

        const preprocesado = preprocesarCaso(raw);
        const { caso, error } = validarCaso(preprocesado, i);
        if (error) {
            errores.push(error);
        } else if (caso) {
            casos.push({ indice: i, caso });
        }
    }

    if (errores.length > 0) {
        return { ok: false, errores, mensaje: `Se encontraron ${errores.length} errores de validación` };
    }
    if (casos.length === 0) {
        return { ok: false, mensaje: "El archivo no contiene casos válidos" };
    }
    return { ok: true, casos };
}

export function parsearJSON(contenido: string): ResultadoParseo {
    let raw: unknown;
    try {
        raw = JSON.parse(contenido);
    } catch {
        return { ok: false, mensaje: "El archivo JSON no es válido" };
    }
    if (!Array.isArray(raw)) {
        return { ok: false, mensaje: "El JSON debe ser un array de casos" };
    }
    if (raw.length === 0) {
        return { ok: false, mensaje: "El archivo no contiene casos" };
    }

    const casos: CasoValidado[] = [];
    const errores: ErrorValidacion[] = [];

    for (let i = 0; i < raw.length; i++) {
        const preprocesado = typeof raw[i] === "object" && raw[i] !== null ? preprocesarCaso(raw[i] as Record<string, unknown>) : raw[i];
        const { caso, error } = validarCaso(preprocesado, i + 1);
        if (error) {
            errores.push(error);
        } else if (caso) {
            casos.push({ indice: i + 1, caso });
        }
    }

    if (errores.length > 0) {
        return { ok: false, errores, mensaje: `Se encontraron ${errores.length} errores de validación` };
    }
    if (casos.length === 0) {
        return { ok: false, mensaje: "El archivo no contiene casos válidos" };
    }
    return { ok: true, casos };
}

export function parsearArchivoSimulacion(contenido: string, formato: "csv" | "json"): ResultadoParseo {
    if (formato === "csv") return parsearCSV(contenido);
    return parsearJSON(contenido);
}

export function normalizarCategoriaEsperada(valor?: string): string | undefined {
    if (!valor) return undefined;
    const limpio = valor.trim().toUpperCase().replace(/\s+/g, "_");
    return limpio || undefined;
}
