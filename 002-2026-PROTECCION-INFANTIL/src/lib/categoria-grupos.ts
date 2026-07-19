import { getParametroSistema } from "./parametros";
import type { ParametroClient } from "./parametros";

export type CategoriaGrupo = {
    clave: string;
    nombre: string;
    orden: number;
    categorias: string[];
};

export type DefinicionGruposCategoria = {
    grupos: CategoriaGrupo[];
};

const CLAVE_PARAMETRO = "ui.grupos_categoria";

export const GRUPOS_CATEGORIA_FALLBACK: CategoriaGrupo[] = [
    {
        clave: "contacto_sexual",
        nombre: "Contacto sexual",
        orden: 1,
        categorias: ["SOLICITUD_MATERIAL", "COMPARTIMIENTO_SEXUAL", "SOLICITUD_ENCUENTRO"],
    },
    {
        clave: "manipulacion_engano",
        nombre: "Manipulación o engaño",
        orden: 2,
        categorias: ["OFRECIMIENTO_REGALOS", "CONTACTO_INSISTENTE", "SUPLANTACION_IDENTIDAD"],
    },
    {
        clave: "amenazas_extorsion",
        nombre: "Amenazas o extorsión",
        orden: 3,
        categorias: ["EXTORSION", "DIFUSION_NO_CONSENTIDA", "DOXING"],
    },
    {
        clave: "contenido_falso_ia",
        nombre: "Contenido falso (IA)",
        orden: 4,
        categorias: ["CONTENIDO_GENERADO_IA"],
    },
    {
        clave: "otro",
        nombre: "Otro",
        orden: 5,
        categorias: ["OTRO"],
    },
];

function esDefinicionValida(def: unknown): def is DefinicionGruposCategoria {
    if (typeof def !== "object" || def === null) return false;
    const { grupos } = def as Record<string, unknown>;
    if (!Array.isArray(grupos) || grupos.length === 0) return false;
    return grupos.every((g) => {
        if (typeof g !== "object" || g === null) return false;
        const grupo = g as Record<string, unknown>;
        return (
            typeof grupo.clave === "string" &&
            grupo.clave.length > 0 &&
            typeof grupo.nombre === "string" &&
            grupo.nombre.length > 0 &&
            typeof grupo.orden === "number" &&
            Number.isFinite(grupo.orden) &&
            Array.isArray(grupo.categorias) &&
            grupo.categorias.length > 0 &&
            grupo.categorias.every((c) => typeof c === "string")
        );
    });
}

export async function obtenerGruposCategoria(
    client?: ParametroClient
): Promise<CategoriaGrupo[]> {
    const param = await getParametroSistema(CLAVE_PARAMETRO, client);
    if (!param) {
        return GRUPOS_CATEGORIA_FALLBACK;
    }
    try {
        const parsed = JSON.parse(param.valor) as unknown;
        if (esDefinicionValida(parsed)) {
            return parsed.grupos;
        }
    } catch {
        // JSON malformado: caer al fallback
    }
    return GRUPOS_CATEGORIA_FALLBACK;
}

export function categoriaAGrupo(
    grupos: CategoriaGrupo[],
    categoriaInterna: string
): CategoriaGrupo | null {
    if (categoriaInterna === "SPAM") return null;
    return grupos.find((g) => g.categorias.includes(categoriaInterna)) || null;
}

export function nombreGrupoCategoria(
    grupos: CategoriaGrupo[],
    claveGrupo: string
): string {
    return grupos.find((g) => g.clave === claveGrupo)?.nombre || claveGrupo;
}

export function nombreGrupoParaCategoria(
    grupos: CategoriaGrupo[],
    categoriaInterna: string
): string {
    const grupo = categoriaAGrupo(grupos, categoriaInterna);
    return grupo?.nombre || categoriaInterna;
}

export type ItemCategoria = { categoria: string; total: number };

export type GrupoAgregado = {
    clave: string;
    nombre: string;
    orden: number;
    total: number;
};

export function agruparCategorias(
    grupos: CategoriaGrupo[],
    items: ItemCategoria[]
): GrupoAgregado[] {
    const mapa = new Map<string, GrupoAgregado>();

    for (const grupo of grupos) {
        mapa.set(grupo.clave, {
            clave: grupo.clave,
            nombre: grupo.nombre,
            orden: grupo.orden,
            total: 0,
        });
    }

    for (const item of items) {
        const grupo = categoriaAGrupo(grupos, item.categoria);
        if (!grupo) continue;
        const actual = mapa.get(grupo.clave);
        if (actual) {
            actual.total += item.total;
        }
    }

    return Array.from(mapa.values())
        .filter((g) => g.total > 0)
        .sort((a, b) => a.orden - b.orden);
}

export async function obtenerGruposConAgrupacion(
    items: ItemCategoria[],
    client?: ParametroClient
): Promise<GrupoAgregado[]> {
    const grupos = await obtenerGruposCategoria(client);
    return agruparCategorias(grupos, items);
}
