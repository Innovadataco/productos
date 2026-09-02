// src/lib/bi/catalogo.ts · Catálogo BI como DATO de BD (candado 8)
// Producto 006 · BI v2 · Fase 2 · motor NL→SQL
// El catálogo NO vive en el prompt ni en el código: se lee de
// BICatalogoTabla/BICatalogoColumna en cada consulta. Un cambio de esquema
// expuesto al LLM es un UPDATE en BD, no un despliegue.
// Candado 3: el catálogo se presenta al LLM ENUMERADO (tabla_idx /
// columna_idx) y el LLM devuelve SOLO índices; el servidor traduce a
// nombres reales. Candado 1: el JSON Schema es CERRADO
// (additionalProperties:false) y acotado al catálogo vigente.

import { prisma } from "@/lib/db";

/** Rol del chat del motor: único consumidor del catálogo en Fase 2. */
const ROL_MOTOR = "ADMIN_BI";

export interface ColumnaCat {
    nombreFuente: string;
    tipo: string;
    /** Descripción de la columna (lleva los valores posibles si es enum) — candado 8. */
    descripcion?: string;
}

/**
 * Dominio de valores declarado para una columna (candado 8: el catálogo es
 * dato). Dos formatos aceptados en la descripción: con prefijo "Valores
 * reales: A · B · C" o la descripción completa siendo solo la lista
 * "A · B · C". Vacío si la columna no declara dominio.
 */
export function valoresDeColumna(col: ColumnaCat): string[] {
    const d = col.descripcion ?? "";
    const conPrefijo = d.match(/Valores reales:\s*(.+)$/i);
    const bruto = conPrefijo ? conPrefijo[1] : d;
    const tokens = bruto
        .split("·")
        .map((s) => s.trim())
        .filter((s) => /^[A-ZÁÉÍÓÚÜ_]+$/i.test(s) && !s.includes(" "));
    // Sin prefijo solo se acepta si TODA la descripción era la lista (evita
    // leer dominios en descripciones narrativas).
    if (!conPrefijo && tokens.join(" · ") !== bruto.trim()) return [];
    return tokens.filter((s) => s.length >= 3 && s !== "OTRO");
}

export interface TablaCat {
    nombreFuente: string;
    nombreLegible: string;
    descripcion: string;
    columnas: ColumnaCat[];
}

export interface Catalogo {
    tablas: TablaCat[];
}

/**
 * Carga el catálogo vigente desde BD: tablas activas visibles para el rol
 * del motor (deny-by-default: una tabla sin 'ADMIN_BI' en rolesPermitidos
 * NO aparece) y solo columnas no excluidas. Orden estable (creadoEn) para
 * que los índices que ve el LLM no cambien entre llamadas salvo que el
 * operador edite el catálogo.
 */
export async function cargarCatalogo(): Promise<Catalogo> {
    const tablas = await prisma.bICatalogoTabla.findMany({
        where: {
            activo: true,
            rolesPermitidos: { has: ROL_MOTOR },
        },
        include: {
            columnas: {
                where: { excluida: false },
                orderBy: { creadoEn: "asc" },
            },
        },
        orderBy: { creadoEn: "asc" },
    });

    return {
        tablas: tablas.map((t) => ({
            nombreFuente: t.nombreFuente,
            nombreLegible: t.nombreLegible,
            descripcion: t.descripcion,
            columnas: t.columnas.map((c) => ({
                nombreFuente: c.nombreFuente,
                tipo: c.tipo,
                descripcion: c.descripcion || undefined,
            })),
        })),
    };
}

/**
 * Presenta el catálogo al LLM como lista ENUMERADA (candado 3): cada tabla
 * y cada columna lleva su índice; el modelo responde con esos índices y el
 * servidor traduce a nombres reales, eliminando paráfrasis y typos.
 */
export function presentarCatalogoParaLLM(cat: Catalogo): string {
    const lineas: string[] = [];
    cat.tablas.forEach((t, tablaIdx) => {
        lineas.push(`[tabla_idx=${tablaIdx}] ${t.nombreLegible} (fuente: ${t.nombreFuente})`);
        if (t.descripcion) {
            lineas.push(`  Descripción: ${t.descripcion}`);
        }
        t.columnas.forEach((c, columnaIdx) => {
            // I-06: la descripción de columna viaja al prompt — cuando es un
            // enum lleva los valores posibles ('Valores: a · b · c') y el LLM
            // elige el valor EXACTO en vez de adivinar la caja.
            const detalle = c.descripcion ? ` — ${c.descripcion}` : "";
            lineas.push(`  [columna_idx=${columnaIdx}] ${c.nombreFuente} · tipo ${c.tipo}${detalle}`);
        });
    });
    return lineas.join("\n");
}

/**
 * JSON Schema CERRADO (candado 1) para el structured output del LLM. Raíz
 * multi-parte (motor v2): { planes: PlanLLM[] } con 1..5 planes — una
 * pregunta puede pedir varias métricas y el modelo descompone. Cada plan
 * solo puede devolver índices dentro del rango del catálogo vigente
 * (maximum = tablas.length - 1), agregaciones y operadores de un enum
 * cerrado, y valores (nunca SQL). additionalProperties:false en TODOS los
 * niveles (raíz, plan, filtros, periodo, ventanaAbsoluta): imposible
 * inventar campos.
 */
export function esquemaJsonParaLLM(cat: Catalogo): Record<string, unknown> {
    // Schema de UN plan (índices del catálogo, enums cerrados, valores).
    const plan: Record<string, unknown> = {
        type: "object",
        properties: {
            tabla_idx: {
                type: "integer",
                minimum: 0,
                maximum: cat.tablas.length - 1,
            },
            columnas_idx: {
                type: "array",
                items: { type: "integer" },
            },
            agregacion: {
                enum: ["conteo", "suma", "promedio", "maximo", "minimo", "lista"],
            },
            filtros: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        columna_idx: { type: "integer" },
                        operador: { enum: ["=", "!=", "<", ">", "<=", ">=", "LIKE"] },
                        valor: { type: ["string", "number"] },
                    },
                    required: ["columna_idx", "operador", "valor"],
                    additionalProperties: false,
                },
            },
            periodo: {
                type: "object",
                properties: {
                    columna_idx: { type: "integer" },
                    dias: { type: "integer", minimum: 1, maximum: 3650 },
                },
                required: ["columna_idx", "dias"],
                additionalProperties: false,
            },
            // Ventana de fechas absoluta (motor v2): [desde, hasta), hasta
            // EXCLUSIVO, formato YYYY-MM-DD exigido por patrón.
            ventanaAbsoluta: {
                type: "object",
                properties: {
                    columna_idx: { type: "integer" },
                    desde: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    hasta: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                },
                required: ["columna_idx", "desde", "hasta"],
                additionalProperties: false,
            },
            // GROUP BY (motor v2): índice de la columna de grupo (texto/enum).
            agruparPor_idx: { type: "integer", minimum: 0 },
            limite: { type: "integer", minimum: 1 },
        },
        required: ["tabla_idx", "columnas_idx", "agregacion"],
        additionalProperties: false,
    };
    return {
        type: "object",
        properties: {
            planes: {
                type: "array",
                minItems: 1,
                maxItems: 5,
                items: plan,
            },
        },
        required: ["planes"],
        additionalProperties: false,
    };
}
