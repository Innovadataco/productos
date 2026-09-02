// src/lib/bi/motor.ts · Orquestador NL→SQL (candados 2, 4, 5, 7, 9, 10, 12)
// Producto 006 · BI v2 · Fase 2 · motor NL→SQL
// Pipeline deny-by-default: intención → catálogo BD → cache humano → LLM
// (structured output, temp 0, seed 42) → checks atómicos → construirSql →
// validarSql → ejecución parametrizada → plantilla determinista.
// Candado 3: el LLM devuelve SOLO índices; el SQL lo construye el servidor
// (constructor-sql) con nombres del catálogo. Candado 12: TODA consulta
// queda en BIConsultaLog (pregunta · SQL · estado · latencia · fuenteCache
// · error) — el logging es fail-open para no tumbar el chat.
// Nota de orden: el catálogo se carga ANTES del cache porque validarSql
// valida contra el catálogo vigente — sin catálogo no hay validación
// posible, ni siquiera del SQL humano cacheado.
// Motor v2 (multi-parte): el schema raíz del LLM es { planes: [...] } (1..5)
// — la pregunta puede pedir varias métricas y el modelo descompone. CADA
// plan recorre el pipeline completo (checks atómicos → constructor →
// validador → ejecución → plantilla): un plan inválido aclara SU tramo sin
// tirar los demás, y la respuesta se compone con una sección por sub-plan
// (plantillas.renderRespuestaCompuesta, cifras siempre del ResultSet).
// Bitácora: UNA fila por consulta — planJson guarda el primer plan (compat
// con el historial) y pasosJson acumula TODO, incluido un paso por sub-plan
// con el JSON completo de cada plan.

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { llamarOllamaStructured } from "@/lib/ai/ollama-client";
import { getModeloSql } from "@/lib/ai/ollama-config";
import { revisarIntencion } from "./reglas-pre";
import { construirSql, type PlanLLM } from "./constructor-sql";
import { validarSql } from "./validador-sql";
import { cargarCatalogo, esquemaJsonParaLLM, presentarCatalogoParaLLM, valoresDeColumna, type Catalogo } from "./catalogo";
import { buscarEnCache, normalizarPregunta } from "./cache";
import { PLANTILLA_SIN_DATOS, renderRespuesta, renderRespuestaCompuesta } from "./plantillas";
import { crearTraza } from "@/lib/observabilidad/traza";

export interface RespuestaMotor {
    estado: "ok" | "clarificacion" | "rechazada" | "sin_datos" | "error";
    texto: string;
    sql?: string;
    filas?: number;
    fuenteCache?: boolean;
    consultaLogId?: string;
}

/**
 * Prompt system del traductor NL→plan (candado 3): catálogo enumerado,
 * el modelo devuelve SOLO índices. Breve a propósito: el catálogo y el
 * schema cerrado hacen el trabajo pesado. Motor v2: enseña las tres
 * capacidades nuevas (multi-parte, ventana absoluta, agrupación).
 */
const SYSTEM_PROMPT =
    "Eres un traductor de preguntas en español a planes de consulta de solo lectura. " +
    "Recibes un catálogo ENUMERADO de tablas y columnas y devuelves SOLO índices numéricos " +
    "de ese catálogo (tabla_idx, columnas_idx) junto con la agregación, los filtros, el " +
    "período y el límite. Nunca escribes SQL ni nombres de tablas o columnas: el servidor " +
    "traduce los índices. Si la pregunta es ambigua, devuelve el plan más simple y directo. " +
    "Si la pregunta pide VARIAS métricas o temas, descomponla: devuelve UN plan por cada " +
    "parte en el arreglo planes (máximo 5), cada uno con su propia tabla, agregación, filtros " +
    "y período. Si la pregunta pide una sola cosa, devuelve planes con exactamente un plan. " +
    "El período es OPCIONAL: inclúyelo SOLO si la pregunta pide explícitamente una ventana " +
    "temporal relativa (hoy ≈ 1 día, esta semana ≈ 7, este mes ≈ 30, este año ≈ 365, últimos N días = N), " +
    "siempre con una columna de fecha del catálogo y dias entero >= 1. Si la pregunta NO pide " +
    "ventana temporal, omite el período por completo. " +
    "Para ventanas con fechas o meses/años CONCRETOS usa ventanaAbsoluta (columna de fecha, " +
    "desde y hasta en formato YYYY-MM-DD, hasta EXCLUSIVO): 'julio de 2025' → desde 2025-07-01 " +
    "hasta 2025-08-01; 'el año 2025' → desde 2025-01-01 hasta 2026-01-01; 'del 10 al 15 de marzo " +
    "de 2025' → desde 2025-03-10 hasta 2025-03-16. Para ventanas relativas ('hoy', 'últimos 30 " +
    "días', 'este mes') usa SIEMPRE período, nunca ventanaAbsoluta. " +
    "Cuando la pregunta pida una distribución o ranking por categoría ('por plataforma', 'por " +
    "estado', 'qué colegios tienen más alertas', 'la categoría más frecuente', 'top N'), usa " +
    "agruparPor_idx con la columna de grupo (debe ser de tipo texto o enum) y la agregación " +
    "correspondiente: conteo para frecuencias (cuenta filas por grupo), o suma/promedio/" +
    "maximo/minimo sobre columnas_idx[0]. NUNCA uses maximo/minimo sobre una columna de texto " +
    "para responder 'el más frecuente': eso es conteo con agruparPor. La agregación lista no " +
    "admite agruparPor. " +
    "No agregues filtros que la pregunta no pide explícitamente: cada filtro debe venir de una " +
    "condición dicha por el usuario. Cuando una columna lista 'Valores reales: a · b · c' en su " +
    "descripción, el valor del filtro debe ser EXACTAMENTE uno de esos valores (nunca una frase " +
    "como 'hace_un_ano' ni una paráfrasis).";

/** Marcas temporales en la pregunta (para el fallback de período malformado). */
const REGEX_MARCAS_TEMPORALES = /\b(hoy|ayer|semanas?|mes(?:es)?|años?|días?|últim[oa]s?|recientes?)\b/i;

/** La pregunta pide explícitamente una ventana temporal. */
function tieneMarcasTemporales(pregunta: string): boolean {
    return REGEX_MARCAS_TEMPORALES.test(pregunta);
}

/** Tope de sub-planes por pregunta (espejo del maxItems del JSON Schema). */
const MAX_PLANES = 5;

/** Texto determinista cuando el catálogo en BD está vacío (candado 8). */
const TEXTO_CATALOGO_VACIO =
    "El catálogo de datos disponibles está vacío, así que no es posible responder consultas todavía. Contacta al administrador de BI.";

/** Texto determinista ante fallo del LLM (candado 2: no se rescata). */
const TEXTO_ERROR_LLM =
    "El modelo de lenguaje no está disponible o no devolvió una respuesta válida. Intenta de nuevo en unos minutos.";

/** Texto determinista de rechazo por intención destructiva (candado 6). */
const TEXTO_RECHAZO_INTENCION =
    "Solo puedo responder consultas de lectura sobre los datos operativos: no puedo borrar, modificar ni crear datos.";

/** Texto determinista cuando el validador post-LLM rechaza el SQL (candado 5). */
const TEXTO_RECHAZO_VALIDADOR =
    "La consulta generada no superó las reglas de seguridad de solo lectura y no se ejecutó. Quedó registrada para revisión.";

/** Texto determinista cuando el constructor no puede armar el plan (candado 4). */
const TEXTO_PLAN_INVALIDO =
    "No pude armar una consulta válida con lo que pediste. Reformula la pregunta indicando qué datos quieres consultar.";

/** Texto determinista de error interno (sin detalles técnicos al usuario). */
const TEXTO_ERROR_INTERNO =
    "Ocurrió un error interno al procesar la consulta. Quedó registrada para revisión.";

function mensajeDeError(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

function esEntero(n: unknown): n is number {
    return typeof n === "number" && Number.isInteger(n);
}

/** Formateo mínimo de una celda para la respuesta genérica del cache. */
function formatearCelda(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

/**
 * SQLSTATE 42P01 (undefined_table): la réplica de PI aún no está activa o
 * la tabla no llegó a la publicación. Prisma lo envuelve como P2010 con
 * meta.code, pero se acepta también el código crudo o el mensaje de pg.
 */
function esTablaInexistente(e: unknown): boolean {
    if (!e || typeof e !== "object") return false;
    const err = e as { code?: unknown; meta?: unknown; message?: unknown };
    if (err.code === "42P01" || err.code === "42703") return true;
    const meta = err.meta as { code?: unknown } | undefined;
    if (meta && (meta.code === "42P01" || meta.code === "42703")) return true;
    // I-07: NADA de coincidencia por mensaje — "function lower(...) does not
    // exist" (42883, función, no tabla) se colaba como sin_datos habiendo
    // datos. Solo los SQLSTATE exactos de tabla/columna inexistente degradan.
    const msg = typeof err.message === "string" ? err.message : "";
    return msg.includes("42P01") || msg.includes("42703");
}

/**
 * Extrae los planes de la respuesta del LLM. El schema raíz vigente es
 * { planes: [...] } (1..5, cerrado). Se acepta también el plan PELADO del
 * schema anterior (objeto con tabla_idx + agregacion) como arreglo de un
 * plan — compat con clientes y mocks previos al cambio de envoltura; cada
 * plan sigue pasando por TODOS los checks atómicos, el constructor y el
 * validador (la tolerancia es de envoltura, nunca de contenido). Devuelve
 * null si la forma no es ninguna de las dos.
 */
function planesDeRespuesta(data: unknown): PlanLLM[] | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const envoltura = (data as { planes?: unknown }).planes;
    if (Array.isArray(envoltura)) return envoltura as PlanLLM[];
    if ("tabla_idx" in data && "agregacion" in data) return [data as PlanLLM];
    return null;
}

/** Crea la fila de traza (candado 12). Fail-open: devuelve "" si falla. */
async function crearLog(preguntaNL: string, usuarioEmail: string): Promise<string> {
    try {
        const fila = await prisma.bIConsultaLog.create({
            data: { usuarioId: usuarioEmail, preguntaNL, estado: "pendiente" },
            select: { id: true },
        });
        return fila.id;
    } catch (e) {
        console.error(`[BI-MOTOR] No se pudo crear BIConsultaLog: ${mensajeDeError(e)}`);
        return "";
    }
}

interface PatchLog {
    estado: string;
    latenciaMs: number;
    sqlGenerado?: string | null;
    planJson?: string | null;
    respuestaTexto?: string | null;
    pasosJson?: string | null;
    fuenteCache?: boolean;
    error?: string | null;
}

/** Cierra la traza con el desenlace. Fail-open: solo registra el error. */
async function cerrarLog(id: string, patch: PatchLog): Promise<void> {
    if (!id) return;
    try {
        await prisma.bIConsultaLog.update({ where: { id }, data: patch });
    } catch (e) {
        console.error(`[BI-MOTOR] No se pudo cerrar BIConsultaLog ${id}: ${mensajeDeError(e)}`);
    }
}

/** Valores enum declarados en la descripción de una columna (formato "Valores reales:" o lista pura — vía catálogo, candado 8). */
function extraerValoresEnum(descripcion: string): string[] {
    return valoresDeColumna({ nombreFuente: "", tipo: "", descripcion });
}

/** La pregunta menciona el valor como token. MAYÚSCULAS (enums) verbatim; minúsculas (estados) case-insensitive. */
function mencionaValor(pregunta: string, valor: string): boolean {
    const escapado = valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = valor === valor.toUpperCase() ? new RegExp(`\\b${escapado}\\b`) : new RegExp(`\\b${escapado}\\b`, "i");
    return re.test(pregunta);
}

/**
 * Checks atómicos del plan (candado 4, deny-by-default): aunque el schema
 * cerrado acota la salida del LLM, NADA se da por válido sin verificar —
 * el JSON puede traer índices fuera de rango o campos ausentes. Devuelve
 * null si el plan es completo o el texto determinista de clarificación
 * que pide exactamente lo que falta.
 *
 * `filtrosCubiertos` (multi-parte): claves "tabla:columna:valor" de TODOS
 * los filtros de TODOS los sub-planes de la pregunta. I-08 no dispara si el
 * valor enum mencionado ya lo filtra OTRO sub-plan (su parte sí lo pedía).
 */
function validarPlanAtomico(
    plan: PlanLLM,
    cat: Catalogo,
    pregunta: string,
    filtrosCubiertos?: Set<string>,
): string | null {
    if (!esEntero(plan.tabla_idx) || plan.tabla_idx < 0 || plan.tabla_idx >= cat.tablas.length) {
        return "No pude identificar sobre qué datos quieres consultar. Reformula la pregunta indicando el tema (por ejemplo: reportes, colegios, suscripciones, facturación).";
    }
    const tabla = cat.tablas[plan.tabla_idx];

    const agregaciones: string[] = ["conteo", "suma", "promedio", "maximo", "minimo", "lista"];
    if (typeof plan.agregacion !== "string" || !agregaciones.includes(plan.agregacion)) {
        return "No pude identificar qué quieres saber de los datos: un conteo, una suma, un promedio o una lista de registros. Reformula la pregunta.";
    }

    const columnasIdx = Array.isArray(plan.columnas_idx) ? plan.columnas_idx : [];
    const requiereColumnas = plan.agregacion !== "conteo";
    const columnasInvalidas = columnasIdx.some(
        (ci) => !esEntero(ci) || ci < 0 || ci >= tabla.columnas.length,
    );
    if ((requiereColumnas && columnasIdx.length === 0) || columnasInvalidas) {
        const ejemplos = tabla.columnas
            .slice(0, 3)
            .map((c) => c.nombreFuente)
            .join(", ");
        return `Para responder necesito saber qué campos de ${tabla.nombreLegible} te interesan (por ejemplo: ${ejemplos}). Reformula la pregunta indicando el campo.`;
    }

    const operadores: string[] = ["=", "!=", "<", ">", "<=", ">=", "LIKE"];
    // El schema marca `filtros` como opcional: el JSON puede omitirlo.
    for (const f of plan.filtros ?? []) {
        const columnaOk = esEntero(f.columna_idx) && f.columna_idx >= 0 && f.columna_idx < tabla.columnas.length;
        const operadorOk = typeof f.operador === "string" && operadores.includes(f.operador);
        const valorOk = typeof f.valor === "string" || typeof f.valor === "number";
        if (!columnaOk || !operadorOk || !valorOk) {
            return "Uno de los filtros no corresponde a un campo y operador válidos. Reformula la consulta usando los campos disponibles.";
        }
    }

    if (plan.periodo) {
        const columnaOk =
            esEntero(plan.periodo.columna_idx) &&
            plan.periodo.columna_idx >= 0 &&
            plan.periodo.columna_idx < tabla.columnas.length;
        const diasOk = esEntero(plan.periodo.dias) && plan.periodo.dias >= 1 && plan.periodo.dias <= 3650;
        if (!columnaOk || !diasOk) {
            return "El período indicado no es válido. Indica una ventana en días (por ejemplo: últimos 7, 30 o 90 días).";
        }
    }

    // Ventana absoluta (motor v2): rango + formato YYYY-MM-DD + orden. La
    // guarda de tipo (solo columnas de fecha) vive en el constructor (I-10).
    if (plan.ventanaAbsoluta) {
        const v = plan.ventanaAbsoluta;
        const columnaOk = esEntero(v.columna_idx) && v.columna_idx >= 0 && v.columna_idx < tabla.columnas.length;
        const formatoOk =
            typeof v.desde === "string" &&
            typeof v.hasta === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(v.desde) &&
            /^\d{4}-\d{2}-\d{2}$/.test(v.hasta) &&
            v.desde <= v.hasta;
        if (!columnaOk || !formatoOk) {
            return "La ventana de fechas absoluta no es válida. Indica el rango con fechas concretas (por ejemplo: del 2025-07-01 al 2025-08-01) o una ventana relativa (últimos 30 días).";
        }
    }

    // Agrupación (motor v2): el índice de grupo debe existir en la tabla. La
    // guarda de tipo (solo texto/enum) vive en el constructor.
    if (plan.agruparPor_idx !== undefined) {
        const grupoOk =
            esEntero(plan.agruparPor_idx) && plan.agruparPor_idx >= 0 && plan.agruparPor_idx < tabla.columnas.length;
        if (!grupoOk) {
            return "No pude identificar por qué campo agrupar los resultados. Reformula la pregunta indicando la categoría (por ejemplo: por estado, por categoría, por plataforma).";
        }
    }

    // I-08: la pregunta nombra VERBATIM un valor enum del catálogo pero el
    // plan no filtra por esa columna → el LLM se tragó el filtro (caso real:
    // "SOLICITUD_MATERIAL" en la pregunta, plan sin filtro → respondía el
    // total 2012 en vez de 153). Deny-by-default: clarificar, no adivinar.
    // Multi-parte: si OTRO sub-plan ya filtra ese valor en esa columna, la
    // mención está cubierta (su tramo sí lo pedía) y no se aclara dos veces.
    const columnasConFiltro = new Set((plan.filtros ?? []).map((f) => f.columna_idx));
    for (const [colIdx, col] of tabla.columnas.entries()) {
        if (columnasConFiltro.has(colIdx)) continue;
        for (const valor of extraerValoresEnum(col.descripcion ?? "")) {
            if (filtrosCubiertos?.has(`${plan.tabla_idx}:${colIdx}:${valor.toLowerCase()}`)) continue;
            if (mencionaValor(pregunta, valor)) {
                return `Mencionaste "${valor}" pero no lo usé como filtro. ¿Quieres filtrar por ${col.nombreFuente} = ${valor}? Reformula la pregunta para confirmarlo.`;
            }
        }
    }

    return null;
}

/** Respuesta determinista para un hit de cache (no hay plan del LLM). */
function textoParaCache(filas: Record<string, unknown>[]): string {
    if (filas.length === 1 && Object.keys(filas[0]).length === 1) {
        return `El resultado es: ${formatearCelda(Object.values(filas[0])[0])}.`;
    }
    return `La consulta devolvió ${filas.length} filas.`;
}

/** Estado agregado de una consulta multi-parte: con datos manda ok; sin datos pero con algo que aclarar, clarificacion; luego rechazada; al final sin_datos. */
function estadoAgregado(hubo: { ok: boolean; clarificacion: boolean; rechazada: boolean }): RespuestaMotor["estado"] {
    if (hubo.ok) return "ok";
    if (hubo.clarificacion) return "clarificacion";
    if (hubo.rechazada) return "rechazada";
    return "sin_datos";
}

/**
 * Punto único del chat NL→SQL. Orquesta el pipeline completo y deja traza
 * en BIConsultaLog pase lo que pase (candado 12).
 */
export async function preguntar(pregunta: string, usuarioEmail: string): Promise<RespuestaMotor> {
    const t0 = Date.now();
    // Observabilidad: reloj de pasos del pipeline (se persiste en pasosJson
    // al cerrar; el chat lo muestra como auditoría "Ver traza").
    const traza = crearTraza();
    traza.paso("recibida", pregunta);
    const logId = await crearLog(pregunta, usuarioEmail);
    // Plan del LLM capturado para la traza (candado 12): índices, filtros y
    // VALORES exactos — sin esto un filtro erróneo del LLM no era depurable.
    // Multi-parte: planJson guarda el PRIMER plan (compat); todos los planes
    // quedan en pasosJson (un paso "sub-plan N" con el JSON completo).
    let planCapturado: PlanLLM | null = null;

    /** Cierra la traza y devuelve la respuesta con su consultaLogId. */
    async function finalizar(r: RespuestaMotor, errorLog?: string): Promise<RespuestaMotor> {
        await cerrarLog(logId, {
            estado: r.estado,
            latenciaMs: Date.now() - t0,
            sqlGenerado: r.sql ?? null,
            planJson: planCapturado ? JSON.stringify(planCapturado) : null,
            respuestaTexto: r.texto,
            pasosJson: JSON.stringify(traza.pasos()),
            fuenteCache: r.fuenteCache ?? false,
            error: errorLog ?? null,
        });
        return { ...r, consultaLogId: logId || undefined };
    }

    try {
        // 1 · Pre-guard determinista ANTES del LLM (candado 6).
        const intencion = revisarIntencion(pregunta);
        traza.paso("pre-guard", intencion.permitida ? "permitida" : `rechazada: ${intencion.motivo ?? "intencion_destructiva"}`);
        if (!intencion.permitida) {
            return await finalizar(
                { estado: "rechazada", texto: TEXTO_RECHAZO_INTENCION },
                intencion.motivo ?? "intencion_destructiva",
            );
        }

        // 2 · Catálogo como DATO de BD (candado 8): sin catálogo no hay
        // validación posible (el validador y el constructor lo exigen).
        const cat = await cargarCatalogo();
        traza.paso("catalogo", `${cat.tablas.length} tablas cargadas`);
        if (cat.tablas.length === 0) {
            return await finalizar({ estado: "error", texto: TEXTO_CATALOGO_VACIO }, "catalogo_vacio");
        }

        // 3 · Cache de veredictos HUMANOS (candado 7): match exacto
        // normalizado. Un hit se re-valida contra el catálogo (candado 5)
        // y se ejecuta sin LLM.
        const hit = await buscarEnCache(normalizarPregunta(pregunta));
        traza.paso("cache", hit ? "hit" : "miss");
        if (hit) {
            const veredictoCache = validarSql(cat, hit.sqlAprobado);
            traza.paso(
                "validador",
                veredictoCache.valida
                    ? "aprobada (cache)"
                    : `rechazada (cache) · ${veredictoCache.violaciones.length} violaciones`,
            );
            if (veredictoCache.valida) {
                try {
                    const tEjecCache = Date.now();
                    const filas = (await prisma.$queryRawUnsafe(hit.sqlAprobado)) as Record<string, unknown>[];
                    traza.paso("ejecucion", `${filas.length} filas · ${Date.now() - tEjecCache} ms`);
                    if (filas.length === 0) {
                        traza.paso("plantilla", "sin_datos");
                        return await finalizar({
                            estado: "sin_datos",
                            texto: PLANTILLA_SIN_DATOS,
                            sql: hit.sqlAprobado,
                            filas: 0,
                            fuenteCache: true,
                        });
                    }
                    traza.paso("plantilla", "respuesta de cache");
                    return await finalizar({
                        estado: "ok",
                        texto: textoParaCache(filas),
                        sql: hit.sqlAprobado,
                        filas: filas.length,
                        fuenteCache: true,
                    });
                } catch (e) {
                    if (esTablaInexistente(e)) {
                        traza.paso("ejecucion", "falló: tabla inexistente (42P01)");
                        traza.paso("plantilla", "sin_datos");
                        return await finalizar(
                            {
                                estado: "sin_datos",
                                texto: PLANTILLA_SIN_DATOS,
                                sql: hit.sqlAprobado,
                                fuenteCache: true,
                            },
                            "42P01",
                        );
                    }
                    throw e;
                }
            }
            // SQL cacheado que ya no pasa el validador: no se ejecuta
            // (deny-by-default); se trata como miss y se sigue por el LLM.
            console.warn(`[BI-MOTOR] Entrada de cache rechazada por el validador: ${veredictoCache.violaciones.join("; ")}`);
        }

        // 4 · LLM con structured output cerrado (candados 1, 2, 3): schema raíz
        // { planes: [...] } (1..5). Si el JSON no parsea, llamarOllamaStructured
        // lanza y NO se rescata.
        let planes: PlanLLM[];
        const tLlm = Date.now();
        try {
            const modelo = await getModeloSql();
            traza.paso("llm-llamada", modelo);
            const prompt =
                `Catálogo de datos disponibles (usa SOLO los índices):\n${presentarCatalogoParaLLM(cat)}\n\n` +
                `Pregunta del usuario: ${pregunta}\n\n` +
                "Devuelve los planes de consulta según el esquema: un plan por cada métrica pedida (máximo 5), solo índices numéricos del catálogo.";
            const res = await llamarOllamaStructured<{ planes: PlanLLM[] }>(
                modelo,
                prompt,
                esquemaJsonParaLLM(cat),
                SYSTEM_PROMPT,
                { temperature: 0, seed: 42 },
            );
            const normalizados = planesDeRespuesta(res.data);
            if (!normalizados) {
                throw new Error("La respuesta del LLM no trae el arreglo planes del schema raíz.");
            }
            planes = normalizados;
            traza.paso("llm-respuesta", `${Date.now() - tLlm} ms · JSON parseado`);
            planCapturado = planes[0] ?? null; // candado 12 (compat): el primer plan va a planJson
        } catch (e) {
            traza.paso("llm-respuesta", `${Date.now() - tLlm} ms · falló o no parseó`);
            console.error(`[BI-MOTOR] LLM falló o JSON inválido: ${mensajeDeError(e)}`);
            return await finalizar({ estado: "error", texto: TEXTO_ERROR_LLM }, mensajeDeError(e));
        }

        if (planes.length === 0) {
            traza.paso("plan-atomico", "clarificación solicitada");
            return await finalizar({ estado: "clarificacion", texto: TEXTO_PLAN_INVALIDO }, "planes_vacios");
        }
        // Tope del schema (maxItems 5): si el modelo se excede, se responden
        // las primeras 5 partes y el exceso queda en la traza (fail-safe:
        // jamás se ejecuta nada más allá del tope).
        if (planes.length > MAX_PLANES) {
            traza.paso("planes", `${planes.length} planes recibidos → se ejecutan los primeros ${MAX_PLANES}`);
            planes = planes.slice(0, MAX_PLANES);
        }

        // Límite de BD (B3), una sola lectura para todos los sub-planes.
        const limiteCfg = Number((await getConfig("bi.motor.limite_maximo")) ?? "500");
        const limiteMaximo = Number.isFinite(limiteCfg) && limiteCfg > 0 ? Math.floor(limiteCfg) : 500;

        // Cobertura global de filtros (I-08 multi-parte): un valor enum
        // mencionado en la pregunta está cubierto si CUALQUIER sub-plan lo
        // filtra en esa columna de esa tabla.
        const filtrosCubiertos = new Set<string>();
        for (const p of planes) {
            for (const f of p?.filtros ?? []) {
                if (typeof f?.valor === "string" || typeof f?.valor === "number") {
                    filtrosCubiertos.add(`${p.tabla_idx}:${f.columna_idx}:${String(f.valor).trim().toLowerCase()}`);
                }
            }
        }

        // 5-9 · Pipeline completo POR SUB-PLAN (candados 3, 4, 5, 9, 10): un
        // plan inválido aclara SU tramo; no tira los demás.
        const multi = planes.length > 1;
        const secciones: string[] = [];
        const sqls: string[] = [];
        const errores: string[] = [];
        const hubo = { ok: false, clarificacion: false, rechazada: false };
        let huboEjecucion = false;
        let filasTotal = 0;

        for (const [i, planOriginal] of planes.entries()) {
            const n = i + 1;
            // Pasos nuevos DESPUÉS de los existentes: con un solo plan los
            // hitos conservan su nombre de siempre; con varios van prefijados
            // por sub-plan y cada sub-plan abre con un paso que lleva su JSON
            // completo (bitácora: pasosJson acumula TODOS los planes).
            const paso = (nombre: string, detalle?: string) =>
                traza.paso(multi ? `sub-plan ${n} · ${nombre}` : nombre, detalle);
            if (multi) {
                traza.paso(`sub-plan ${n}`, JSON.stringify(planOriginal));
            }
            const plan: PlanLLM = { ...planOriginal };

            // Precedencia ventana absoluta > período relativo sobre la MISMA
            // columna (criterio I-03), resuelta ANTES de los checks: no tiene
            // sentido pedir clarificación por un período que la ventana manda.
            if (plan.periodo && plan.ventanaAbsoluta && plan.periodo.columna_idx === plan.ventanaAbsoluta.columna_idx) {
                delete plan.periodo;
            }

            // 5 · Checks atómicos (candado 4): si falta algo, clarificación.
            let faltante = validarPlanAtomico(plan, cat, pregunta, filtrosCubiertos);
            // Fallback determinista (I-03): si el único problema es el período
            // malformado por el LLM y la pregunta NO pedía ventana temporal, se
            // descarta el período y se responde sin él — la consulta sin ventana
            // es la respuesta correcta para esa pregunta.
            if (
                faltante &&
                plan.periodo &&
                faltante.startsWith("El período indicado") &&
                !tieneMarcasTemporales(pregunta)
            ) {
                delete plan.periodo;
                faltante = validarPlanAtomico(plan, cat, pregunta, filtrosCubiertos);
            }
            if (faltante) {
                paso("plan-atomico", "clarificación solicitada");
                hubo.clarificacion = true;
                errores.push("plan_incompleto");
                secciones.push(faltante);
                continue;
            }
            paso("plan-atomico", "completo");

            // I-13: período espurio — si la pregunta NO tiene ninguna marca
            // temporal y el LLM aun así agregó un período, se descarta (caso
            // real: "alertas escaladas sin gestionar" llegó con 1 día espurio y
            // respondía 0 habiendo 254). Simétrico al fallback de I-03.
            if (plan.periodo && !tieneMarcasTemporales(pregunta)) {
                delete plan.periodo;
            }

            // 6 · El SERVIDOR construye el SQL (candado 3) con límite de BD (B3).
            const construido = construirSql(cat, plan, limiteMaximo);
            if (!construido.ok) {
                // Doble defensa tras validarPlanAtomico: el constructor también
                // es deny-by-default y su rechazo significa plan inválido.
                paso("sql-construido", `falló: ${construido.error}`);
                hubo.clarificacion = true;
                errores.push(construido.error);
                secciones.push(TEXTO_PLAN_INVALIDO);
                continue;
            }
            const { sql, params } = construido;
            paso("sql-construido", `límite ${limiteMaximo}`);

            // 7 · Validador post-LLM estricto (candado 5): si no aprueba, no se
            // ejecuta; se registra para revisión humana.
            const veredicto = validarSql(cat, sql);
            paso(
                "validador",
                veredicto.valida ? "aprobada" : `rechazada · ${veredicto.violaciones.length} violaciones`,
            );
            if (!veredicto.valida) {
                hubo.rechazada = true;
                errores.push(veredicto.violaciones.join("; ") || "validador_sql");
                sqls.push(sql);
                secciones.push(TEXTO_RECHAZO_VALIDADOR);
                continue;
            }

            // 8 · Ejecución parametrizada contra la réplica (solo lectura).
            let filas: Record<string, unknown>[];
            const tEjec = Date.now();
            try {
                filas = (await prisma.$queryRawUnsafe(sql, ...params)) as Record<string, unknown>[];
                paso("ejecucion", `${filas.length} filas · ${Date.now() - tEjec} ms`);
            } catch (e) {
                if (esTablaInexistente(e)) {
                    // Réplica aún sin la tabla: candado 9, no se inventa.
                    paso("ejecucion", "falló: tabla inexistente (42P01)");
                    paso("plantilla", "sin_datos");
                    huboEjecucion = true;
                    errores.push("42P01");
                    sqls.push(sql);
                    secciones.push(PLANTILLA_SIN_DATOS);
                    continue;
                }
                throw e;
            }
            huboEjecucion = true;
            sqls.push(sql);
            filasTotal += filas.length;

            // 9 · Plantilla determinista (candados 9 y 10): cifras del ResultSet.
            if (filas.length === 0) {
                paso("plantilla", "sin_datos");
                secciones.push(PLANTILLA_SIN_DATOS);
                continue;
            }
            const texto = renderRespuesta(plan, filas, cat);
            paso("plantilla", `agregación: ${plan.agregacion}`);
            hubo.ok = true;
            secciones.push(texto);
        }

        // 10 · Composición multi-parte: una sola respuesta, una sección por
        // sub-plan (candado 10: cada cifra salió de su propio ResultSet).
        const respuesta: RespuestaMotor = {
            estado: estadoAgregado(hubo),
            texto: renderRespuestaCompuesta(secciones),
            ...(sqls.length > 0 ? { sql: sqls.join("\n") } : {}),
            ...(huboEjecucion ? { filas: filasTotal } : {}),
        };
        return await finalizar(respuesta, errores.length > 0 ? errores.join("; ") : undefined);
    } catch (e) {
        console.error(`[BI-MOTOR] Error inesperado: ${mensajeDeError(e)}`);
        return await finalizar({ estado: "error", texto: TEXTO_ERROR_INTERNO }, mensajeDeError(e));
    }
}
