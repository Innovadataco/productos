/**
 * SPEC-227 (002-PI-128): serialización del export CSV del historial (FR-006/007).
 * Columnas FIJAS de metadatos (contracts §export): NUNCA `titulo`,
 * `descripcion` ni `datosContexto` — la plantilla de la regla puede renderizar
 * datos del cliente (PII). Módulo puro; la pseudonimización llega por
 * `pseudonimizarSujeto` con la sal de entorno.
 */
import { formatInTimeZone } from "date-fns-tz";
import { ZONA_BOGOTA } from "./periodos";
import { pseudonimizarSujeto } from "./pseudonimizar";

/** Columnas exactas del contrato (orden incluido). */
export const COLUMNAS_EXPORT = [
    "recomendacion_id",
    "regla_clave",
    "regla_nombre",
    "categoria",
    "prioridad",
    "estado",
    "generada_en",
    "resuelta_en",
    "tiempo_resolucion_horas",
    "ejecutada_automatica",
    "sujeto_tipo",
    "sujeto_hash",
] as const;

/** Subconjunto de campos de `Recomendacion` que el DAL entrega para exportar. */
export interface RecomendacionParaExport {
    id: string;
    categoria: string;
    prioridad: number;
    estado: string;
    generadaEn: Date;
    resueltaEn: Date | null;
    ejecutadaAutomatica: boolean;
    sujetoTipo: string | null;
    sujetoId: string | null;
    regla: { clave: string; nombre: string } | null;
}

export type FilaExport = Record<(typeof COLUMNAS_EXPORT)[number], string | number | boolean>;

function isoBogota(fecha: Date): string {
    return formatInTimeZone(fecha, ZONA_BOGOTA, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Horas entre generación y resolución, 1 decimal; cadena vacía si no resuelta. */
export function tiempoResolucionHoras(generadaEn: Date, resueltaEn: Date | null): string {
    if (!resueltaEn) return "";
    const horas = (resueltaEn.getTime() - generadaEn.getTime()) / 3_600_000;
    return horas.toFixed(1);
}

/** Construye las filas del CSV aplicando el hash opaco al sujeto (FR-007). */
export function construirFilasExport(recomendaciones: RecomendacionParaExport[], sal: string | undefined): FilaExport[] {
    return recomendaciones.map((r) => ({
        recomendacion_id: r.id,
        regla_clave: r.regla?.clave ?? "",
        regla_nombre: r.regla?.nombre ?? "",
        categoria: r.categoria,
        prioridad: r.prioridad,
        estado: r.estado,
        generada_en: isoBogota(r.generadaEn),
        resuelta_en: r.resueltaEn ? isoBogota(r.resueltaEn) : "",
        tiempo_resolucion_horas: tiempoResolucionHoras(r.generadaEn, r.resueltaEn),
        ejecutada_automatica: r.ejecutadaAutomatica,
        sujeto_tipo: r.sujetoTipo ?? "",
        sujeto_hash: pseudonimizarSujeto(r.sujetoId, sal) ?? "",
    }));
}

/** Escape CSV (patrón de `api/admin/ia/simulaciones/[id]/export/route.ts`). */
export function toCsv(filas: FilaExport[], columnas: readonly string[] = COLUMNAS_EXPORT): string {
    const encabezado = columnas.join(",");
    const lineas = filas.map((fila) =>
        columnas
            .map((col) => {
                const valor = fila[col as keyof FilaExport];
                if (valor === null || valor === undefined) return "";
                const str = String(valor);
                if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            })
            .join(",")
    );
    return [encabezado, ...lineas].join("\n");
}

/** `recomendaciones-YYYYMMDD-HHmm.csv` (hora Bogotá, contracts §export). */
export function nombreArchivoExport(ahora: Date = new Date()): string {
    return `recomendaciones-${formatInTimeZone(ahora, ZONA_BOGOTA, "yyyyMMdd-HHmm")}.csv`;
}
