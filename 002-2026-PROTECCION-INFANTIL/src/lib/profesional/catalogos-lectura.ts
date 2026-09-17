/**
 * SPEC-685 · Lectores de los catálogos cerrados de la ficha (PR2).
 *
 * El catálogo vive en `ParametroSistema` (lo edita el admin, SPEC-685 PR1). El
 * runtime lo lee de ahí y, si el parámetro falta o está corrupto, cae al DEFAULT
 * de `catalogos.ts` — así una edición mala del admin (o un parámetro ausente en
 * un entorno recién sembrado) NUNCA tumba la ficha con un 500.
 *
 * Este módulo SÍ toca Prisma (por eso está separado de `catalogos.ts`, que es
 * datos puros e importa el seed). Dos usos:
 *   1. `leerCatalogosFicha()` — lo que la ficha pinta (profesión/áreas/rango).
 *   2. `clavesValidasCatalogo()` — los conjuntos de claves válidas para que la
 *      API RECHACE fuera de catálogo (no basta el `<select>` del cliente:
 *      un gate condicionado a un valor del cliente falla ABIERTO).
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import {
    CLAVE_CAT_PROFESION,
    CLAVE_CAT_AREAS,
    CLAVE_CAT_RANGO_ETARIO,
    PROFESION_DEFAULT,
    AREAS_ATENCION_DEFAULT,
    RANGO_ETARIO_DEFAULT,
    clavesDe,
    clavesDeAreas,
    type OpcionCatalogo,
    type GrupoAreas,
} from "./catalogos";

function esOpcion(v: unknown): v is OpcionCatalogo {
    return (
        typeof v === "object" &&
        v !== null &&
        typeof (v as { clave?: unknown }).clave === "string" &&
        typeof (v as { nombre?: unknown }).nombre === "string"
    );
}

function esListaOpciones(v: unknown): v is OpcionCatalogo[] {
    return Array.isArray(v) && v.length > 0 && v.every(esOpcion);
}

function esGrupos(v: unknown): v is GrupoAreas[] {
    return (
        Array.isArray(v) &&
        v.length > 0 &&
        v.every(
            (g) =>
                typeof g === "object" &&
                g !== null &&
                typeof (g as { grupo?: unknown }).grupo === "string" &&
                esListaOpciones((g as { items?: unknown }).items),
        )
    );
}

/** Lee un catálogo del parámetro; cae al DEFAULT si falta o no valida. */
async function leerCatalogo<T>(clave: string, fallback: T, valida: (v: unknown) => v is T): Promise<T> {
    const raw = await getParametroSistemaValor(clave);
    if (raw == null) return fallback;
    try {
        const parsed: unknown = JSON.parse(raw);
        return valida(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

export const leerProfesion = (): Promise<OpcionCatalogo[]> =>
    leerCatalogo(CLAVE_CAT_PROFESION, PROFESION_DEFAULT, esListaOpciones);
export const leerAreas = (): Promise<GrupoAreas[]> =>
    leerCatalogo(CLAVE_CAT_AREAS, AREAS_ATENCION_DEFAULT, esGrupos);
export const leerRangoEtario = (): Promise<OpcionCatalogo[]> =>
    leerCatalogo(CLAVE_CAT_RANGO_ETARIO, RANGO_ETARIO_DEFAULT, esListaOpciones);

export interface CatalogosFicha {
    profesion: OpcionCatalogo[];
    areas: GrupoAreas[];
    rangoEtario: OpcionCatalogo[];
}

/** Lo que la ficha pinta: los tres catálogos, ya con fallback aplicado. */
export async function leerCatalogosFicha(): Promise<CatalogosFicha> {
    const [profesion, areas, rangoEtario] = await Promise.all([leerProfesion(), leerAreas(), leerRangoEtario()]);
    return { profesion, areas, rangoEtario };
}

export interface ClavesValidasCatalogo {
    profesion: Set<string>;
    areas: Set<string>;
    rango: Set<string>;
}

/** Conjuntos de claves válidas para que la API rechace fuera de catálogo. */
export async function clavesValidasCatalogo(): Promise<ClavesValidasCatalogo> {
    const c = await leerCatalogosFicha();
    return {
        profesion: clavesDe(c.profesion),
        areas: clavesDeAreas(c.areas),
        rango: clavesDe(c.rangoEtario),
    };
}
