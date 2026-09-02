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
// Motor v2 (tres capacidades aprobadas):
//   · ventanaAbsoluta: rango de fechas [desde, hasta) parametrizado con
//     ::date, hasta EXCLUSIVO; manda sobre período/filtros de la misma
//     columna (mismo criterio que I-03) y solo aplica a columnas de fecha
//     (guarda I-10) con formato YYYY-MM-DD verificado (guarda I-07).
//   · agruparPor_idx: GROUP BY sobre una columna de texto/enum —
//     SELECT "grupo" AS grupo, AGG(...) AS valor … GROUP BY "grupo"
//     ORDER BY valor DESC. Rechaza lista+agrupar, ids, fechas y números.
// B3: el tope absoluto llega como parámetro `limiteMaximo` (lo lee el llamador
// desde bi_config); aquí no hay umbrales hardcodeados salvo el default de
// filas cuando el plan no pide límite (constante documentada abajo).

import { valoresDeColumna, type Catalogo, type ColumnaCat, type TablaCat } from "@/lib/bi/catalogo";

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
    /** Ventana de fechas absoluta [desde, hasta) en YYYY-MM-DD; hasta EXCLUSIVO. Manda sobre período/filtros de la misma columna (criterio I-03). */
    ventanaAbsoluta?: { columna_idx: number; desde: string; hasta: string };
    /** GROUP BY sobre esta columna (solo texto/enum): SELECT "grupo" AS grupo + agregado AS valor, ORDER BY valor DESC. */
    agruparPor_idx?: number;
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

/** Tipos numéricos del catálogo (guarda I-12 y guarda de tipo de agruparPor). */
const TIPOS_NUMERICOS: ReadonlySet<string> = new Set([
    "int", "integer", "float", "bigint", "decimal", "number", "numeric", "double", "real",
]);

/** La columna es de fecha/tiempo (guarda I-10, reutilizada por ventanaAbsoluta). */
function esColumnaFecha(col: ColumnaCat): boolean {
    const tipo = col.tipo.toLowerCase();
    return tipo.includes("date") || tipo.includes("time");
}

/**
 * Fecha estricta YYYY-MM-DD (guarda I-07 reutilizada por ventanaAbsoluta):
 * regex + parseo real del calendario (rechaza p.ej. 2025-02-31 o 2025-13-01).
 */
function esFechaIso(valor: unknown): valor is string {
    if (typeof valor !== "string") return false;
    const v = valor.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    return !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

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
 * en `params` en el mismo orden (filtros → ventana absoluta → período → límite).
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

    // --- agruparPor (GROUP BY): índice opcional a una columna de TEXTO/ENUM ---
    // Criterio (determinista): agrupar solo tiene sentido sobre dimensiones
    // categóricas. Se rechaza:
    //   · "lista" con agruparPor (una lista proyecta filas, no las resume)
    //   · identificadores (nombre "id" o sufijo "Id": cada grupo tendría 1 fila)
    //   · fechas, números y booleanos (agrupar por valor crudo no agrega:
    //     fechas/números requieren buckets — fuera de alcance; un booleano
    //     son 2 grupos y la agregación simple responde mejor)
    // I-12 sigue mandando abajo: MAX/MIN solo sobre numérica/fecha.
    let colGrupo: ColumnaCat | null = null;
    if (plan.agruparPor_idx !== undefined) {
        if (plan.agregacion === "lista") {
            return fallo(
                'La agregación "lista" no admite agruparPor: una lista proyecta filas, no las resume. Usa conteo (o suma/promedio) con agruparPor.',
            );
        }
        const resuelta = resolverColumna(tabla, plan.agruparPor_idx);
        if (!resuelta) {
            return fallo(
                `agruparPor_idx fuera de rango: ${String(plan.agruparPor_idx)} (tabla "${tabla.nombreFuente}": 0..${tabla.columnas.length - 1}).`,
            );
        }
        const nombre = resuelta.nombreFuente;
        if (nombre === "id" || nombre.endsWith("Id")) {
            return fallo(
                `Agrupar por "${nombre}" no resume nada: es un identificador (cada grupo tendría una sola fila). Usa una columna de texto o enum (estado, categoria, plataforma...).`,
            );
        }
        const tipoGrupo = resuelta.tipo.toLowerCase();
        if (esColumnaFecha(resuelta) || TIPOS_NUMERICOS.has(tipoGrupo) || tipoGrupo === "boolean" || tipoGrupo === "bool") {
            return fallo(
                `agruparPor solo aplica a columnas de texto o enum: "${nombre}" es tipo ${resuelta.tipo}. Fechas y números requieren rangos/buckets, fuera del alcance actual.`,
            );
        }
        colGrupo = resuelta;
    }

    // --- SELECT según la agregación pedida (con prefijo de grupo si aplica) ---
    const prefijoGrupo = colGrupo ? `${citarIdentificador(colGrupo.nombreFuente)} AS grupo, ` : "";
    let selectList: string;
    if (plan.agregacion === "conteo") {
        selectList = colGrupo ? `${prefijoGrupo}COUNT(*) AS valor` : "COUNT(*) AS total";
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
        // I-12: MAX/MIN sobre columna NO numérica ni fecha es sinsentido
        // semántico disfrazado de respuesta (caso real: "categoría más
        // frecuente" devolvió el MAX alfabético del enum = STALKING — confiado
        // y ERRADO; la frecuencia se calcula agrupando, no con MAX).
        if (plan.agregacion === "maximo" || plan.agregacion === "minimo") {
            const esNumericaOFecha = TIPOS_NUMERICOS.has(col.tipo.toLowerCase()) || esColumnaFecha(col);
            if (!esNumericaOFecha) {
                return fallo(
                    `"${plan.agregacion}" no aplica a "${col.nombreFuente}" (tipo ${col.tipo}): sería el máximo alfabético, no el más frecuente. Para "el más frecuente" usa conteo con agruparPor sobre esa columna.`,
                );
            }
        }
        selectList = `${prefijoGrupo}${FUNCION_POR_AGREGACION[plan.agregacion]}(${citarIdentificador(col.nombreFuente)}) AS valor`;
    } else {
        return fallo(`Agregación no soportada: ${String(plan.agregacion)}.`);
    }

    // --- Ventana absoluta [desde, hasta): validación ANTES del WHERE ---
    // Guardas reutilizadas: I-10 (solo columnas de fecha) e I-07 (formato de
    // fecha verificado, nunca texto libre). Precedencia (mismo criterio que
    // I-03): si el período relativo cae sobre la MISMA columna, manda la
    // ventana absoluta — el período se descarta igual que los filtros de esa
    // columna (ANDarlos re-abriría el bug de las ventanas que se pisan).
    let ventana: { idx: number; col: ColumnaCat; desde: string; hasta: string } | null = null;
    if (plan.ventanaAbsoluta !== undefined) {
        const v = plan.ventanaAbsoluta;
        if (!v || typeof v !== "object") {
            return fallo("ventanaAbsoluta debe ser un objeto { columna_idx, desde, hasta }.");
        }
        const col = resolverColumna(tabla, v.columna_idx);
        if (!col) {
            return fallo(
                `ventanaAbsoluta.columna_idx fuera de rango: ${String(v.columna_idx)} (tabla "${tabla.nombreFuente}").`,
            );
        }
        if (!esColumnaFecha(col)) {
            return fallo(
                `La ventana absoluta solo aplica a columnas de fecha: "${col.nombreFuente}" es tipo ${col.tipo}. Usa la columna de fecha de la tabla (creadoEn/createdAt).`,
            );
        }
        if (!esFechaIso(v.desde) || !esFechaIso(v.hasta)) {
            return fallo(
                `ventanaAbsoluta.desde/hasta deben ser fechas YYYY-MM-DD válidas (recibido: desde=${JSON.stringify(v.desde)} hasta=${JSON.stringify(v.hasta)}).`,
            );
        }
        const desde = v.desde.trim();
        const hasta = v.hasta.trim();
        if (desde > hasta) {
            return fallo(`ventanaAbsoluta.desde (${desde}) debe ser menor o igual que hasta (${hasta}).`);
        }
        ventana = { idx: v.columna_idx, col, desde, hasta };
    }

    const periodoEfectivo =
        ventana && plan.periodo !== undefined && plan.periodo.columna_idx === ventana.idx ? undefined : plan.periodo;

    // --- WHERE: filtros parametrizados + ventana/período opcionales ---
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
        // Mismo criterio para la ventana absoluta: si la columna ya quedó
        // acotada por [desde, hasta), un filtro extra sobre ella se descarta.
        if (periodoEfectivo !== undefined && filtro.columna_idx === periodoEfectivo.columna_idx) {
            continue;
        }
        if (ventana && filtro.columna_idx === ventana.idx) {
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
        // I-07 (guarda determinista de tipos): el LLM a veces pone texto
        // ("ahora", "hace_un_ano") en columnas con tipo — Postgres falla con
        // 42883/22007 en ejecución. Se rechaza ANTES, como plan inválido:
        const tipoCol = col.tipo.toLowerCase();
        if (typeof valor === "string" && (tipoCol.includes("date") || tipoCol.includes("time"))) {
            const esFecha = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(valor.trim());
            if (!esFecha) {
                return fallo(`El valor "${valor}" no es una fecha válida para la columna "${col.nombreFuente}" (tipo ${col.tipo}). Para ventanas relativas existe el período.`);
            }
        }
        if (typeof valor === "string" && (tipoCol === "int" || tipoCol === "float" || tipoCol === "bigint")) {
            if (!/^-?\d+(\.\d+)?$/.test(valor.trim())) {
                return fallo(`El valor "${valor}" no es numérico para la columna "${col.nombreFuente}" (tipo ${col.tipo}).`);
            }
        }
        // I-14: si la columna declara dominio ("Valores reales" o lista en su
        // descripción — candado 8), el valor del filtro DEBE pertenecer a él.
        // Caso real: prioridad='nueva' (valor que solo existe en `estado`) →
        // ANDado con estado='escalada' daba 0 habiendo 254. Rechazo con la
        // lista correcta en el mensaje, antes de ejecutar.
        const dominio = valoresDeColumna(col);
        if (
            typeof valor === "string" &&
            (filtro.operador === "=" || filtro.operador === "!=") &&
            dominio.length > 0 &&
            !dominio.some((v) => v.toLowerCase() === valor.trim().toLowerCase())
        ) {
            return fallo(
                `"${valor}" no es un valor válido de "${col.nombreFuente}". Valores válidos: ${dominio.join(" · ")}.`,
            );
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

    // Ventana absoluta: "col" >= $N::date AND "col" < $(N+1)::date — hasta
    // EXCLUSIVO ([desde, hasta): julio 2025 = [2025-07-01, 2025-08-01)). Las
    // fechas viajan parametrizadas; jamás interpoladas (candado 3).
    if (ventana) {
        const nombreCitado = citarIdentificador(ventana.col.nombreFuente);
        params.push(ventana.desde, ventana.hasta);
        condiciones.push(`${nombreCitado} >= $${params.length - 1}::date AND ${nombreCitado} < $${params.length}::date`);
    }

    if (periodoEfectivo !== undefined) {
        const col = resolverColumna(tabla, periodoEfectivo.columna_idx);
        if (!col) {
            return fallo(
                `periodo.columna_idx fuera de rango: ${String(periodoEfectivo.columna_idx)} (tabla "${tabla.nombreFuente}").`,
            );
        }
        // I-10: el período SOLO aplica a columnas de fecha. Caso real: el LLM
        // puso el período sobre `estado` (texto) → "text >= timestamp" (42883)
        // en runtime. Rechazo determinista antes de ejecutar.
        if (!esColumnaFecha(col)) {
            return fallo(
                `El período solo aplica a columnas de fecha: "${col.nombreFuente}" es tipo ${col.tipo}. Usa la columna de fecha de la tabla (creadoEn/createdAt).`,
            );
        }
        const dias = periodoEfectivo.dias;
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
    // GROUP BY + ORDER BY valor DESC: el ranking por grupo (top N) es la
    // forma agrupada; `valor` es el alias del agregado declarado en el SELECT.
    const groupOrder = colGrupo ? ` GROUP BY ${citarIdentificador(colGrupo.nombreFuente)} ORDER BY valor DESC` : "";
    const sql = `SELECT ${selectList} FROM ${citarIdentificador(tabla.nombreFuente)}${where}${groupOrder} LIMIT $${params.length}`;
    return { ok: true, sql, params };
}
