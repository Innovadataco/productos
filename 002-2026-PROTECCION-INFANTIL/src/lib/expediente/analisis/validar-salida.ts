/**
 * SPEC-341 (T015 · FR-014) — anti-frases pre-horneadas.
 *
 * El brief prohíbe frases interpretativas de plantilla. Este validador
 * consulta `padre.analisis.frases_prohibidas_json` y rechaza la salida
 * si contiene alguna. Case-insensitive; substring match (simple pero
 * suficiente — la lista se cura desde admin).
 */
import { getParametroSistemaValor } from "../../parametros";

export type ResultadoValidacion =
    | { ok: true }
    | { ok: false; motivo: string; fraseDetectada: string };

let cache: { frases: string[]; cargadoEn: number } | null = null;
const TTL_CACHE_MS = 60_000; // el admin cambia raras veces; TTL corto es OK

async function cargarFrases(): Promise<string[]> {
    if (cache && Date.now() - cache.cargadoEn < TTL_CACHE_MS) return cache.frases;
    const raw = await getParametroSistemaValor("padre.analisis.frases_prohibidas_json");
    if (!raw) {
        cache = { frases: [], cargadoEn: Date.now() };
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        const arr: string[] = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
        cache = { frases: arr, cargadoEn: Date.now() };
        return arr;
    } catch {
        // Si el parámetro está mal formado, mejor devolver lista vacía que romper el worker
        // — el operador ve el warn y arregla el JSON; el modelo publica sin filtro por esa ventana.
        console.warn("[analisis] padre.analisis.frases_prohibidas_json no es JSON válido — sin filtro esta corrida");
        cache = { frases: [], cargadoEn: Date.now() };
        return [];
    }
}

export async function validarSalida(texto: string): Promise<ResultadoValidacion> {
    const frases = await cargarFrases();
    const lower = texto.toLowerCase();
    for (const frase of frases) {
        if (lower.includes(frase.toLowerCase())) {
            return { ok: false, motivo: "frase_prohibida", fraseDetectada: frase };
        }
    }
    return { ok: true };
}

// Solo para tests: forzar la próxima recarga.
export function _invalidarCacheParaTests(): void {
    cache = null;
}
