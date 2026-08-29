/**
 * SPEC-053 (US3, módulo IA): DTOs de evaluaciones, experimentos y simulaciones.
 * Las formas replican EXACTAMENTE los cuerpos de respuesta que las rutas ya
 * devolvían (refactor puro, FR-007: los payloads Prisma no salen del DAL salvo
 * que la ruta ya los expusiera antes — se conserva ese contrato).
 */

/** Fila del detalle/export de una simulación (join SimulacionReporte + Reporte + ClasificacionIA). */
export type FilaSimulacionDto = {
    indice: number;
    identificador: string;
    categoriaEsperada: string;
    categoriaAsignada: string;
    confianza: number | string;
    estado: string;
    latenciaMs: number | string;
    modeloUsado: string;
    acierto: string;
};

/** Ítem del listado paginado de resultados de una simulación. */
export interface ResultadoSimulacionDto {
    indice: number;
    identificador: string;
    reporteId: string;
    estado: string;
    categoriaEsperada: string | null;
    categoriaAsignada: string;
    confianza: number | null;
    latenciaMs: number | null;
    modeloUsado: string | null;
    acierto: boolean | null;
}

/** Resultado por corrida dentro de la comparación de simulaciones. */
export interface ResultadoComparacionSimulacionDto {
    runId: string;
    modelo: string;
    identificador: string;
    categoriaEsperada: string | null;
    categoriaAsignada: string;
    confianza: number | null;
    estado: string;
    acierto: boolean | null;
}
