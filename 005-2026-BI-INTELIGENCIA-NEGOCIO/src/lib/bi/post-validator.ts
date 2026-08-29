import type { CatalogoTablaResuelto } from "./tipos";

export interface ResultadoValidador {
    valido: boolean;
    razon?: string;
    detalle?: string;
}

const RE_LIMIT = /\bLIMIT\s+(\d+)\b/i;
const RE_SELECT_INICIO = /^\s*SELECT\b/i;
const RE_FROM = /\bFROM\s+([a-zA-Z_][\w"]*(?:\s*,\s*[a-zA-Z_][\w"]*)*)/gi;
const RE_JOIN = /\bJOIN\s+([a-zA-Z_][\w"]*)/gi;
const RE_JOIN_SIN_ON = /\bJOIN\s+[a-zA-Z_][\w"]*(?!\s+[a-zA-Z_][\w"]*\s+ON\b)(?![^;]*\bON\b)/i;
const RE_WHERE_TENANT = /\bWHERE\b[\s\S]*?\btenant_id\s*=/i;

const LIMITE_MAX = 1000;

function normalizarNombreTabla(raw: string): string {
    return raw.replace(/["`\s]/g, "").toLowerCase();
}

function extraerTablas(sql: string): string[] {
    const nombres = new Set<string>();
    for (const match of sql.matchAll(RE_FROM)) {
        const lista = match[1].split(",").map((s) => s.trim());
        for (const t of lista) {
            const soloNombre = t.split(/\s+/)[0];
            nombres.add(normalizarNombreTabla(soloNombre));
        }
    }
    for (const match of sql.matchAll(RE_JOIN)) {
        nombres.add(normalizarNombreTabla(match[1]));
    }
    return Array.from(nombres);
}

function extraerJoinsSinOn(sql: string): boolean {
    const joinsMatches = Array.from(sql.matchAll(/\bJOIN\s+[a-zA-Z_][\w"]*(?:\s+[a-zA-Z_][\w"]*)?/gi));
    const onMatches = (sql.match(/\bON\b/gi) || []).length;
    return joinsMatches.length > onMatches;
}

export function validarSqlGenerado(
    sql: string,
    catalogoResuelto: CatalogoTablaResuelto,
    rol: string,
): ResultadoValidador {
    if (typeof sql !== "string" || sql.trim().length === 0) {
        return { valido: false, razon: "sql_vacio" };
    }
    if (!RE_SELECT_INICIO.test(sql)) {
        return { valido: false, razon: "sql_no_es_select" };
    }
    const limitMatch = sql.match(RE_LIMIT);
    if (!limitMatch) {
        return { valido: false, razon: "limit_missing_o_excedido", detalle: "sin LIMIT" };
    }
    const limite = parseInt(limitMatch[1], 10);
    if (isNaN(limite) || limite > LIMITE_MAX) {
        return {
            valido: false,
            razon: "limit_missing_o_excedido",
            detalle: `LIMIT ${limite} excede ${LIMITE_MAX}`,
        };
    }
    if (extraerJoinsSinOn(sql)) {
        return { valido: false, razon: "join_sin_on" };
    }
    const tablas = extraerTablas(sql);
    const permitidasNorm = catalogoResuelto.tablasPermitidas.map(normalizarNombreTabla);
    for (const t of tablas) {
        if (!permitidasNorm.includes(t)) {
            return { valido: false, razon: "tabla_no_permitida", detalle: t };
        }
    }
    // columnas excluidas: check simple – buscar aparición literal en SELECT
    const selectPart = sql.split(/\bFROM\b/i)[0] ?? "";
    for (const tabla of Object.keys(catalogoResuelto.columnasExcluidas)) {
        for (const col of catalogoResuelto.columnasExcluidas[tabla]) {
            const rx = new RegExp(`\\b${col}\\b`, "i");
            if (rx.test(selectPart)) {
                return { valido: false, razon: "columna_excluida", detalle: `${tabla}.${col}` };
            }
        }
    }
    if (rol !== "ADMIN" && !RE_WHERE_TENANT.test(sql)) {
        return { valido: false, razon: "falta_where_tenant" };
    }
    return { valido: true };
}
