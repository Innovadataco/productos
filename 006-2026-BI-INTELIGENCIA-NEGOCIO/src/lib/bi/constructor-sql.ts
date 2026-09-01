// src/lib/bi/constructor-sql.ts · Constructor determinístico de SQL (candado 3)
// Producto 006 · BI v2 · Motor NL→SQL
// CANDADO 3: el LLM NUNCA emite SQL libre. Devuelve un plan con ÍNDICES
// numéricos sobre el catálogo enumerado (tabla_idx · columnas_idx) y este
// módulo traduce esos índices a los nombres reales del catálogo, armando el
// SQL de forma determinística:
//   · identificadores entre comillas dobles y SIEMPRE del catálogo (jamás del LLM)
//   · valores SIEMPRE parametrizados ($1, $2, …) — nada se interpola en el SQL
//   · deny-by-default: índice fuera de rango, operador fuera del enum,
//     agregación desconocida o valor no escalar → { ok: false, error }
//   · UNA sola tabla por consulta (v1: sin JOINs)
//   · LIMIT siempre presente, parametrizado y con clamp al máximo del servidor
// B3: el tope absoluto llega como parámetro `limiteMaximo` (lo lee el llamador
// desde bi_config); aquí no hay umbrales hardcodeados salvo el default de
// filas cuando el plan no pide límite (constante documentada abajo).

import type { Catalogo, ColumnaCat, TablaCat } from "@/lib/bi/catalogo";

export type Agregacion = "conteo" | "suma" | "promedio" | "maximo" | "minimo" | "lista";

export type Operador = "=" | "!=" | "<" | ">" | "<=" | ">=" | "LIKE";

export interface FiltroLLM {
    columna_idx: number;
    operador: Operador;
    valor: string | number;
}

export interface PlanLLM {
    tabla_idx: number;
    columnas_idx: number[];
    agregacion: Agregacion;
    filtros: FiltroLLM[];
    periodo?: { columna_idx: number; dias: number };
    limite?: number;
}

export type ResultadoConstructor = { ok: true; sql: string; params: unknown[] } | { ok: false; error: string };

/** Filas por defecto cuando el plan no trae `limite`; el tope duro siempre es `limiteMaximo` del llamador. */
const LIMITE_POR_DEFECTO = 100;

/** Operadores del enum cerrado (candado 1): validación runtime porque el plan viene de JSON no confiable. */
const OPERADORES_PERMITIDOS: ReadonlySet<string> = new Set(["=", "!=", "<", ">", "<=", ">=", "LIKE"]);

/** Función SQL por agregación escalar; "conteo" (COUNT(*)) y "lista" (proyección) se arman aparte. */
const FUNCION_POR_AGREGACION: Readonly<Record<Exclude<Agregacion, "conteo" | "lista">, string>> = {
    suma: "SUM",
    promedio: "AVG",
    maximo: "MAX",
    minimo: "MIN",
};

function fallo(error: string): ResultadoConstructor {
    return { ok: false, error };
}

/** Identificador SQL entre comillas dobles; el nombre SIEMPRE viene del catálogo (se escapan comillas por defensa). */
function citarIdentificador(nombre: string): string {
    return `"${nombre.replace(/"/g, '""')}"`;
}

/** Traduce un índice a la columna del catálogo; deny-by-default si no es entero o está fuera de rango. */
function resolverColumna(tabla: TablaCat, idx: number): ColumnaCat | null {
    if (!Number.isInteger(idx) || idx < 0 || idx >= tabla.columnas.length) return null;
    return tabla.columnas[idx];
}

/**
 * Construye el SQL de solo lectura para un plan del LLM. El texto SQL solo
 * contiene identificadores del catálogo y placeholders $N; los valores van
 * en `params` en el mismo orden (filtros → periodo → límite).
 */
export function construirSql(cat: Catalogo, plan: PlanLLM, limiteMaximo: number): ResultadoConstructor {
    if (!cat || !Array.isArray(cat.tablas) || cat.tablas.length === 0) {
        return fallo("El catálogo no tiene tablas disponibles.");
    }
    if (!plan || typeof plan !== "object") {
        return fallo("El plan del LLM no es un objeto.");
    }

    // --- Tabla: índice entero dentro del catálogo (candado 3 · deny-by-default) ---
    if (!Number.isInteger(plan.tabla_idx) || plan.tabla_idx < 0 || plan.tabla_idx >= cat.tablas.length) {
        return fallo(`tabla_idx fuera de rango: ${String(plan.tabla_idx)} (catálogo: 0..${cat.tablas.length - 1}).`);
    }
    const tabla: TablaCat = cat.tablas[plan.tabla_idx];

    // --- Columnas del plan: arreglo de índices válidos; se deduplican preservando orden ---
    if (!Array.isArray(plan.columnas_idx)) {
        return fallo("columnas_idx debe ser un arreglo de índices.");
    }
    const columnas: ColumnaCat[] = [];
    const indicesVistos = new Set<number>();
    for (const idx of plan.columnas_idx) {
        const col = resolverColumna(tabla, idx);
        if (!col) {
            return fallo(
                `columnas_idx fuera de rango: ${String(idx)} (tabla "${tabla.nombreFuente}": 0..${tabla.columnas.length - 1}).`,
            );
        }
        if (indicesVistos.has(idx)) continue;
        indicesVistos.add(idx);
        columnas.push(col);
    }

    // --- SELECT según la agregación pedida ---
    let selectList: string;
    if (plan.agregacion === "conteo") {
        selectList = "COUNT(*) AS total";
    } else if (plan.agregacion === "lista") {
        const cols = columnas.length > 0 ? columnas : tabla.columnas;
        if (cols.length === 0) {
            return fallo(`La tabla "${tabla.nombreFuente}" no tiene columnas en el catálogo.`);
        }
        selectList = cols.map((c) => citarIdentificador(c.nombreFuente)).join(", ");
    } else if (
        plan.agregacion === "suma" ||
        plan.agregacion === "promedio" ||
        plan.agregacion === "maximo" ||
        plan.agregacion === "minimo"
    ) {
        const col = columnas[0];
        if (!col) {
            return fallo(`La agregación "${plan.agregacion}" requiere al menos una columna en columnas_idx.`);
        }
        selectList = `${FUNCION_POR_AGREGACION[plan.agregacion]}(${citarIdentificador(col.nombreFuente)}) AS valor`;
    } else {
        return fallo(`Agregación no soportada: ${String(plan.agregacion)}.`);
    }

    // --- WHERE: filtros parametrizados + periodo opcional ---
    const params: unknown[] = [];
    const condiciones: string[] = [];

    // El JSON Schema del LLM (catalogo.esquemaJsonParaLLM) marca `filtros` como
    // opcional: su ausencia significa "sin filtros", no un plan inválido. Un
    // filtro PRESENTE pero malformado sí se rechaza (deny-by-default).
    const filtros = plan.filtros ?? [];
    if (!Array.isArray(filtros)) {
        return fallo("filtros debe ser un arreglo (posiblemente vacío).");
    }
    for (const filtro of filtros) {
        // Dedupe (I-03): si el plan trae período sobre una columna, los filtros
        // sobre ESA MISMA columna se descartan — el período (ventana relativa
        // NOW() - N días) manda. Caso real: "este mes" llegó del LLM como rango
        // absoluto a medianoche + período; ANDados excluían los datos del día
        // en curso y el motor respondía sin_datos habiendo datos.
        if (plan.periodo !== undefined && filtro.columna_idx === plan.periodo.columna_idx) {
            continue;
        }
        const col = resolverColumna(tabla, filtro.columna_idx);
        if (!col) {
            return fallo(`filtro.columna_idx fuera de rango: ${String(filtro.columna_idx)} (tabla "${tabla.nombreFuente}").`);
        }
        if (!OPERADORES_PERMITIDOS.has(filtro.operador)) {
            return fallo(`Operador no permitido: ${String(filtro.operador)}.`);
        }
        const valor = filtro.valor;
        if (typeof valor !== "string" && typeof valor !== "number") {
            return fallo(`Valor de filtro no soportado (solo string o number): ${typeof valor}.`);
        }
        if (typeof valor === "number" && !Number.isFinite(valor)) {
            return fallo("Valor de filtro numérico no finito (NaN o Infinity).");
        }
        params.push(valor);
        // I-05/I-07: igualdad case-insensitive para texto. PI mezcla
        // convenciones ('escalada' vs 'CONTACTO_INSISTENTE') y además algunas
        // columnas son ENUM de Postgres (CategoriaConducta): LOWER() sobre un
        // enum falla con 42883 — el cast ::text lo resuelve para ambos.
        const nombreCitado = citarIdentificador(col.nombreFuente);
        if (typeof valor === "string" && (filtro.operador === "=" || filtro.operador === "!=")) {
            condiciones.push(`LOWER(${nombreCitado}::text) ${filtro.operador} LOWER($${params.length})`);
        } else {
            condiciones.push(`${nombreCitado} ${filtro.operador} $${params.length}`);
        }
    }

    if (plan.periodo !== undefined) {
        const col = resolverColumna(tabla, plan.periodo.columna_idx);
        if (!col) {
            return fallo(
                `periodo.columna_idx fuera de rango: ${String(plan.periodo.columna_idx)} (tabla "${tabla.nombreFuente}").`,
            );
        }
        const dias = plan.periodo.dias;
        if (typeof dias !== "number" || !Number.isFinite(dias) || dias < 0) {
            return fallo(`periodo.dias debe ser un número finito >= 0: ${String(dias)}.`);
        }
        params.push(Math.floor(dias));
        condiciones.push(`${citarIdentificador(col.nombreFuente)} >= NOW() - ($${params.length} || ' days')::interval`);
    }

    // --- LIMIT: siempre presente, parametrizado, con clamp al máximo del servidor ---
    const maxPermitido = Number.isFinite(limiteMaximo) && limiteMaximo >= 1 ? Math.floor(limiteMaximo) : 1;
    let limite = LIMITE_POR_DEFECTO;
    if (plan.limite !== undefined) {
        if (typeof plan.limite !== "number" || !Number.isFinite(plan.limite)) {
            return fallo(`limite debe ser un número finito: ${String(plan.limite)}.`);
        }
        limite = Math.floor(plan.limite);
    }
    limite = Math.min(Math.max(limite, 1), maxPermitido);
    params.push(limite);

    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";
    const sql = `SELECT ${selectList} FROM ${citarIdentificador(tabla.nombreFuente)}${where} LIMIT $${params.length}`;
    return { ok: true, sql, params };
}
