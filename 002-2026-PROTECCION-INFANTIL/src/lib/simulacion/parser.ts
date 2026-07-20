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

export function parsearCSV(contenido: string): ResultadoParseo {
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length === 0) {
        return { ok: false, mensaje: "El archivo no contiene casos" };
    }

    const cabecera = lineas[0].split(",").map((c) => c.trim().toLowerCase());
    const idxTexto = cabecera.indexOf("texto");
    const idxPlataforma = cabecera.indexOf("plataforma");
    const idxIdentificador = cabecera.indexOf("identificador");
    const idxCategoria = cabecera.indexOf("categoriaesperada");

    if (idxTexto === -1 || idxPlataforma === -1 || idxIdentificador === -1) {
        return { ok: false, mensaje: "CSV debe tener columnas texto, plataforma, identificador (y opcional categoriaEsperada)" };
    }

    const casos: CasoValidado[] = [];
    const errores: ErrorValidacion[] = [];

    for (let i = 1; i < lineas.length; i++) {
        const celdas = lineas[i].split(",");
        // Soportar texto entre comillas simples o dobles; simplificación: si el campo empieza y termina con comillas, quitarlas.
        const raw: Record<string, string> = {};
        raw.texto = celdas[idxTexto]?.trim().replace(/^["']|["']$/g, "") || "";
        raw.plataforma = celdas[idxPlataforma]?.trim().replace(/^["']|["']$/g, "") || "";
        raw.identificador = celdas[idxIdentificador]?.trim().replace(/^["']|["']$/g, "") || "";
        if (idxCategoria !== -1) {
            const cat = celdas[idxCategoria]?.trim().replace(/^["']|["']$/g, "");
            if (cat) raw.categoriaEsperada = cat;
        }

        const { caso, error } = validarCaso(raw, i);
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
        const { caso, error } = validarCaso(raw[i], i + 1);
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
