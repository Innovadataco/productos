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

export interface ResolucionCatalogo {
    /** Mensaje de error 400 si alguna clave cae fuera de catálogo; null si todo válido. */
    error: string | null;
    /** Etiqueta de la profesión elegida, para la columna legado `tituloProfesional`. */
    tituloProfesional?: string;
    /** Etiquetas de las áreas elegidas, para la columna legado `especialidades`. */
    especialidades?: string[];
}

/**
 * SPEC-685 (PR2) · Valida que profesión/áreas/rango caigan DENTRO del catálogo vivo
 * y, de paso, DERIVA las etiquetas para las columnas legado (expandir-contraer): mientras
 * `tituloProfesional`/`especialidades` sigan NOT NULL y con lectores, se escriben DESDE
 * las claves nuevas — nunca cadena vacía ni centinela. Un solo leído del catálogo.
 *
 * Solo mira las listas que vengan en el body (los tres campos son opcionales en un PUT
 * parcial). `rangoEtario` no tiene columna legado: solo se valida.
 */
export async function validarYderivarLegado(d: {
    profesion?: string | undefined;
    areasAtencion?: string[] | undefined;
    rangoEtario?: string[] | undefined;
}): Promise<ResolucionCatalogo> {
    const pideProfesion = d.profesion !== undefined && d.profesion !== "";
    const pideAreas = d.areasAtencion !== undefined && d.areasAtencion.length > 0;
    const pideRango = d.rangoEtario !== undefined && d.rangoEtario.length > 0;
    if (!pideProfesion && !pideAreas && !pideRango) return { error: null };

    const cat = await leerCatalogosFicha();
    const itemsAreas = cat.areas.flatMap((g) => g.items);

    if (pideProfesion && !clavesDe(cat.profesion).has(d.profesion as string)) {
        return { error: "Elija una profesión de la lista." };
    }
    if (pideAreas && !(d.areasAtencion as string[]).every((a) => clavesDeAreas(cat.areas).has(a))) {
        return { error: "Hay un área de atención que no está en la lista. Elíjalas del listado." };
    }
    if (pideRango && !(d.rangoEtario as string[]).every((r) => clavesDe(cat.rangoEtario).has(r))) {
        return { error: "Hay un rango de edad que no está en la lista. Elíjalos del listado." };
    }

    const res: ResolucionCatalogo = { error: null };
    if (pideProfesion) {
        // Membresía ya validada arriba → el find existe.
        const op = cat.profesion.find((o) => o.clave === d.profesion);
        if (op) res.tituloProfesional = op.nombre;
    }
    if (pideAreas) {
        const porClave = new Map(itemsAreas.map((o) => [o.clave, o.nombre]));
        res.especialidades = (d.areasAtencion as string[]).map((a) => porClave.get(a) as string);
    }
    return res;
}
