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
import { validarYderivarLegado } from "@/lib/profesional/catalogos-lectura";

export interface ClavesPerfilCatalogo {
    profesion: string;
    areasAtencion: string[];
    rangoEtario: string[];
}

export interface PerfilCatalogoSeed extends ClavesPerfilCatalogo {
    tituloProfesional: string;
    especialidades: string[];
}

/** Cohorte Red de Apoyo (acoso/ansiedad). Claves REALES del catálogo SPEC-685. */
export const CLAVES_SEED_RED_APOYO: ClavesPerfilCatalogo = {
    profesion: "psicologo",
    areasAtencion: ["ansiedad", "acoso_escolar"],
    rangoEtario: ["6-11", "12-17"],
};

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
