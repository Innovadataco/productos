/**
 * SPEC-341 (A-68 §4.4 capa 2 · T010) — hash determinista de la cadena.
 *
 * El hash decide si el análisis vigente sigue sirviendo (mismo hash → no
 * gastar modelo) o si la cadena cambió (hash distinto → encolar generación).
 * Se calcula sobre EXACTAMENTE tres columnas del `Expediente`:
 *   1. `ultimoEventoEn` (marca temporal del último evento visible)
 *   2. `numEventos` (contador cache que se sube en cada agregar-evento)
 *   3. `categoriasDominantesJson` (agregado por categoría del expediente)
 *
 * Elegimos estas tres porque juntas resumen "qué mira el análisis": si no
 * cambió cuándo ocurrió el último hecho ni cuántos hay ni cómo se
 * distribuyen por categoría, el modelo no tiene nada nuevo que interpretar.
 */
import { createHash } from "node:crypto";

/** Normaliza un JSON a forma canónica: claves ordenadas alfabéticamente en cada nivel. */
function normalizarJson(valor: unknown): unknown {
    if (valor === null || typeof valor !== "object") return valor;
    if (Array.isArray(valor)) return valor.map(normalizarJson);
    const entradas = Object.entries(valor as Record<string, unknown>)
        .map(([k, v]) => [k, normalizarJson(v)] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entradas);
}

export interface EntradaHashCadena {
    ultimoEventoEn: Date | null;
    numEventos: number;
    categoriasDominantesJson: unknown; // Prisma.JsonValue en runtime; unknown para no importar el tipo aquí
}

/** SHA-256 hex de los 3 campos canonicalizados. Determinista. */
export function calcularHashCadena(entrada: EntradaHashCadena): string {
    const canonico = JSON.stringify({
        ultimoEventoEn: entrada.ultimoEventoEn?.toISOString() ?? null,
        numEventos: entrada.numEventos,
        categoriasDominantesJson: normalizarJson(entrada.categoriasDominantesJson ?? null),
    });
    return createHash("sha256").update(canonico).digest("hex");
}
