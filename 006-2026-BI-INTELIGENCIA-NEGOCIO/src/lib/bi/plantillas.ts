// src/lib/bi/plantillas.ts · Salida narrativa DETERMINISTA (candados 9 y 10)
// Producto 006 · BI v2 · Fase 2 · motor NL→SQL
// Candado 10: la cifra numérica viene SIEMPRE del ResultSet, NUNCA de texto
// libre del modelo — el LLM solo eligió el plan; estas plantillas atan los
// slots a filas reales. Candado 9: si no hay filas (o el agregado salió
// NULL, p.ej. SUM sobre conjunto vacío), se responde con la plantilla
// determinista de sin-datos; jamás se completa con supuestos.
// Motor v2: render de planes agrupados (GROUP BY → ranking grupo/valor) y
// composición multi-parte (una sección por sub-plan, misma regla de cifras).

import type { PlanLLM } from "./constructor-sql";
import type { Catalogo } from "./catalogo";

export const PLANTILLA_SIN_DATOS =
    "No hay datos operativos para esa consulta. Puede ser que aún no se registren eventos de esa categoría o el criterio sea muy específico.";

/** La lista (y el ranking agrupado) resume como máximo 5 filas (slot acotado, candado 10). */
const MAX_FILAS_LISTA = 5;

/** Nombre legible de la función de agregación para la plantilla escalar. */
const NOMBRE_AGREGACION: Record<string, string> = {
    suma: "Suma",
    promedio: "Promedio",
    maximo: "Máximo",
    minimo: "Mínimo",
};

/**
 * Formatea un valor del ResultSet de forma determinista. El driver pg
 * devuelve COUNT/SUM/AVG como string numérica y los timestamps como Date:
 * se normalizan a número (máx. 2 decimales) y a fecha ISO corta.
 */
function formatearValor(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number") {
        return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    }
    if (typeof v === "string") {
        const n = Number(v);
        if (v.trim() !== "" && Number.isFinite(n)) {
            return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
        }
        return v;
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

/** Extrae el escalar de un ResultSet de una celda (agregaciones). */
function extraerEscalar(filas: Record<string, unknown>[]): string | null {
    const valores = Object.values(filas[0]);
    if (valores.length === 0) return null;
    const v = valores[0];
    if (v === null || v === undefined) return null;
    return formatearValor(v);
}

/** Texto del slot temporal: período relativo en días o ventana absoluta [desde, hasta). */
function textoPeriodo(plan: PlanLLM): string {
    if (plan.periodo) return ` en los últimos ${plan.periodo.dias} días`;
    const v = plan.ventanaAbsoluta;
    if (v) return ` del ${v.desde} al ${v.hasta} (hasta exclusivo)`;
    return "";
}

/** Etiqueta de una columna del ResultSet: nombre del catálogo si existe. */
function etiquetaColumna(cat: Catalogo, tablaIdx: number, claveFila: string): string {
    const tabla = cat.tablas[tablaIdx];
    const col = tabla?.columnas.find((c) => c.nombreFuente === claveFila);
    return col?.nombreFuente ?? claveFila;
}

/**
 * Renderiza la respuesta al usuario con plantillas deterministas por
 * agregación. Toda cifra sale de `filas` (ResultSet real); los nombres
 * legibles salen del catálogo de BD. Si no hay filas o el agregado es
 * NULL → PLANTILLA_SIN_DATOS (candado 9: no se inventa).
 */
export function renderRespuesta(
    plan: PlanLLM,
    filas: Record<string, unknown>[],
    cat: Catalogo,
): string {
    if (filas.length === 0) return PLANTILLA_SIN_DATOS;

    const tabla = cat.tablas[plan.tabla_idx];
    const tablaLegible = tabla?.nombreLegible ?? tabla?.nombreFuente ?? "la tabla consultada";
    const periodo = textoPeriodo(plan);

    // Agrupado (GROUP BY): ranking determinista grupo → valor. Las filas del
    // ResultSet llegan con los alias fijos del constructor: { grupo, valor }.
    if (plan.agruparPor_idx !== undefined && plan.agregacion !== "lista") {
        const grupoLegible = tabla?.columnas[plan.agruparPor_idx]?.nombreFuente ?? "grupo";
        const hasta = Math.min(MAX_FILAS_LISTA, filas.length);
        const lineas = filas.slice(0, hasta).map((fila, i) => {
            const sufijo = plan.agregacion === "conteo" ? " registros" : "";
            return `${i + 1}. ${formatearValor(fila.grupo)}: ${formatearValor(fila.valor)}${sufijo}`;
        });
        if (plan.agregacion === "conteo") {
            return `Top ${hasta} de ${tablaLegible} por ${grupoLegible}${periodo}:\n${lineas.join("\n")}`;
        }
        const fn = NOMBRE_AGREGACION[plan.agregacion] ?? plan.agregacion;
        const columnaLegible = tabla?.columnas[plan.columnas_idx[0]]?.nombreFuente ?? "la columna consultada";
        return `Top ${hasta} por ${grupoLegible} en ${tablaLegible} (${fn} de ${columnaLegible})${periodo}:\n${lineas.join("\n")}`;
    }

    if (plan.agregacion === "conteo") {
        const n = extraerEscalar(filas);
        if (n === null) return PLANTILLA_SIN_DATOS;
        return `En ${tablaLegible} hay ${n} registros${periodo}.`;
    }

    if (plan.agregacion === "lista") {
        const hasta = Math.min(MAX_FILAS_LISTA, filas.length);
        const lineas = filas.slice(0, hasta).map((fila, i) => {
            const pares = Object.entries(fila).map(
                ([clave, valor]) => `${etiquetaColumna(cat, plan.tabla_idx, clave)}: ${formatearValor(valor)}`,
            );
            return `${i + 1}. ${pares.join(" · ")}`;
        });
        return `Mostrando ${hasta} de ${filas.length} registros de ${tablaLegible}${periodo}:\n${lineas.join("\n")}`;
    }

    // suma · promedio · maximo · minimo: escalar sobre una columna del plan
    const valor = extraerEscalar(filas);
    if (valor === null) return PLANTILLA_SIN_DATOS;
    const fn = NOMBRE_AGREGACION[plan.agregacion] ?? plan.agregacion;
    const columna = tabla?.columnas[plan.columnas_idx[0]];
    const columnaLegible = columna?.nombreFuente ?? "la columna consultada";
    return `${fn} de ${columnaLegible} en ${tablaLegible}${periodo}: ${valor}.`;
}

/**
 * Compone UNA respuesta a partir de las secciones de cada sub-plan
 * (multi-parte, motor v2): la pregunta puede pedir varias métricas y cada
 * tramo ya viene resuelto con su plantilla (cifras del ResultSet) o con su
 * texto determinista de clarificación/rechazo/sin-datos — un tramo fallido
 * aclara su parte sin tirar las demás. Con una sola sección el texto es
 * idéntico al de siempre.
 */
export function renderRespuestaCompuesta(secciones: string[]): string {
    return secciones.filter((s) => s.trim().length > 0).join("\n\n");
}
