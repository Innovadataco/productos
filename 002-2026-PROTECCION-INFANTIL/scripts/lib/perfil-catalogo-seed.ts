/**
 * SPEC-685 · Helper de siembra: llena las columnas de catálogo del PerfilProfesional
 * (profesion, areasAtencion, rangoEtario) con CLAVES válidas y, con la MISMA función que
 * la doble escritura de la API (`validarYderivarLegado`, PR2/#633), deriva las etiquetas
 * legado `tituloProfesional`/`especialidades`. Mientras las columnas viejas sigan NOT NULL
 * y con lectores, se escriben DESDE las claves — NUNCA "" ni [].
 *
 * Lo usan las dos siembras (seed-e2e-profesionales-por-estado y poblar-red-apoyo) para que
 * los perfiles sembrados sean coherentes con lo que crea el alta real. Las claves de cada
 * cohorte se exportan para que el candado las valide contra el catálogo.
 */
import { validarYderivarLegado, leerProfesion, leerAreas, leerRangoEtario } from "@/lib/profesional/catalogos-lectura";

export interface ClavesPerfilCatalogo {
    profesion: string;
    areasAtencion: string[];
    rangoEtario: string[];
}

export interface PerfilCatalogoSeed extends ClavesPerfilCatalogo {
    tituloProfesional: string;
    especialidades: string[];
}

/** Cohorte E2E por estado de compuerta (SPEC-690). Claves REALES del catálogo. */
export const CLAVES_SEED_E2E_ESTADO: ClavesPerfilCatalogo = {
    profesion: "psicologo",
    areasAtencion: ["ansiedad", "conducta"],
    rangoEtario: ["6-11", "12-17"],
};

/**
 * Deriva las 5 columnas (claves nuevas + etiquetas legado) usando la MISMA validación y
 * derivación que la API. ABORTA si el catálogo vivo no valida las claves o no produce
 * etiquetas — una siembra NUNCA escribe "" ni []. Necesita BD (lee el catálogo vivo; cae
 * al DEFAULT del repo si el parámetro no está sembrado).
 */
export async function derivarPerfilCatalogoSeed(claves: ClavesPerfilCatalogo): Promise<PerfilCatalogoSeed> {
    const r = await validarYderivarLegado(claves);
    if (r.error) {
        throw new Error(`[seed-catalogo] claves fuera del catálogo vivo: ${r.error} — ${JSON.stringify(claves)}`);
    }
    if (!r.tituloProfesional || !r.especialidades || r.especialidades.length === 0) {
        throw new Error(
            `[seed-catalogo] la derivación no produjo etiquetas legado para ${JSON.stringify(claves)} — ` +
                'no se siembra "" ni [].',
        );
    }
    return {
        profesion: claves.profesion,
        areasAtencion: claves.areasAtencion,
        rangoEtario: claves.rangoEtario,
        tituloProfesional: r.tituloProfesional,
        especialidades: r.especialidades,
    };
}

// ── SPEC-685 (seguimiento) · Asignación VARIADA y determinista para la Red de Apoyo ──
// El CEO: 50 perfiles con las MISMAS claves clonan el directorio de la demo. Se asigna por
// índice, rotando sobre el catálogo VIVO (profesiones × combos de rango × ventanas de áreas),
// con 1 a 3 áreas. Determinista y estable entre corridas (idempotente); la doble escritura se
// deriva de esas claves con `derivarPerfilCatalogoSeed`. Candado: ninguna combinación se repite
// más de N veces sobre la población.

export interface ListasCatalogo {
    profesiones: string[];
    areas: string[];
    rangos: string[];
}

/** Lee las LISTAS de claves del catálogo VIVO (cae al DEFAULT del repo si falta el parámetro). */
export async function leerListasCatalogo(): Promise<ListasCatalogo> {
    const [prof, areasGrupos, rangos] = await Promise.all([leerProfesion(), leerAreas(), leerRangoEtario()]);
    return {
        profesiones: prof.map((o) => o.clave),
        areas: areasGrupos.flatMap((g) => g.items.map((i) => i.clave)),
        rangos: rangos.map((o) => o.clave),
    };
}

/** Combos de rango deterministas: cada rango solo + pares adyacentes + (si hay ≥2) el total. */
function combosRango(rangos: string[]): string[][] {
    const combos: string[][] = rangos.map((r) => [r]);
    for (let i = 0; i + 1 < rangos.length; i++) combos.push([rangos[i], rangos[i + 1]]);
    if (rangos.length >= 2) combos.push([...rangos]);
    return combos;
}

/**
 * Lista DETERMINISTA y VARIADA de combinaciones de claves, generada del catálogo vivo:
 * profesión × combo-de-rango × ventana-de-áreas (tamaño 1..3, ventana deslizante sin solape
 * consecutivo). Orden estable → asignar por índice es estable entre corridas. Con el catálogo
 * por defecto (2 profesiones · 3 rangos → 6 combos de rango · 3 tamaños) da 36 combinaciones.
 */
export function combosRedApoyo(l: ListasCatalogo): ClavesPerfilCatalogo[] {
    if (l.profesiones.length === 0 || l.areas.length === 0 || l.rangos.length === 0) {
        throw new Error("[seed-catalogo] catálogo vivo incompleto: no se puede asignar variedad.");
    }
    const rangoCombos = combosRango(l.rangos);
    const combos: ClavesPerfilCatalogo[] = [];
    let off = 0;
    for (const profesion of l.profesiones) {
        for (const rangoEtario of rangoCombos) {
            for (let size = 1; size <= 3 && size <= l.areas.length; size++) {
                const areasAtencion = Array.from({ length: size }, (_, k) => l.areas[(off + k) % l.areas.length]);
                off += size; // sin solape consecutivo → conjuntos de áreas más distintos
                combos.push({ profesion, areasAtencion, rangoEtario });
            }
        }
    }
    return combos;
}

/** Asignación estable por índice: rota sobre los combos generados del catálogo vivo. */
export function clavesRedApoyoParaIndice(idx: number, combos: ClavesPerfilCatalogo[]): ClavesPerfilCatalogo {
    if (combos.length === 0) throw new Error("[seed-catalogo] no hay combinaciones para asignar.");
    return combos[Math.abs(idx) % combos.length];
}

/** Serialización canónica de una combinación (para contar repeticiones en el candado). */
export function firmaCombo(c: ClavesPerfilCatalogo): string {
    return JSON.stringify({
        p: c.profesion,
        a: [...c.areasAtencion].sort(),
        r: [...c.rangoEtario].sort(),
    });
}
