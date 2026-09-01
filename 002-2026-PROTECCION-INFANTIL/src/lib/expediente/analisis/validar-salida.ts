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

/**
 * Audit #214 · candado 2: FAIL-CLOSED.
 *
 * El validador es la ÚNICA reja entre el modelo y el padre. Si el parámetro
 * está ausente o mal formado, se lanza — el worker cae al camino de FALLIDO
 * (mismo comportamiento que `prompt.ts` sin `prompt_sistema`). Mejor un aviso
 * al padre ("intento no completó") que publicar texto sin filtrar.
 */
async function cargarFrases(): Promise<string[]> {
    if (cache && Date.now() - cache.cargadoEn < TTL_CACHE_MS) return cache.frases;
    const raw = await getParametroSistemaValor("padre.analisis.frases_prohibidas_json");
    if (!raw) {
        throw new Error(
            "[analisis] Parámetro padre.analisis.frases_prohibidas_json ausente — el validador es fail-closed (audit #214)"
        );
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(
            "[analisis] padre.analisis.frases_prohibidas_json no es JSON válido — fail-closed, el análisis se marca FALLIDO"
        );
    }
    if (!Array.isArray(parsed)) {
        throw new Error(
            "[analisis] padre.analisis.frases_prohibidas_json no es un array JSON — fail-closed"
        );
    }
    const arr: string[] = parsed.filter((s): s is string => typeof s === "string");
    cache = { frases: arr, cargadoEn: Date.now() };
    return arr;
}

export async function validarSalida(texto: string): Promise<ResultadoValidacion> {
    // Si `cargarFrases` lanza, el llamador (ejecutor-analisis) lo captura y
    // marca el análisis FALLIDO — la UI muestra "intento no completó".
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
