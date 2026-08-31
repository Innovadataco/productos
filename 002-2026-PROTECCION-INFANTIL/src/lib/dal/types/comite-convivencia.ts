/**
 * SPEC-168 (Fase F): DTOs del Comité de Convivencia por colegio.
 */

export interface ComiteCuentaDto {
    id: string;
    email: string;
    estado: string;
    debeCambiarPassword: boolean;
    ultimaSesion: string | null;
    creadoEn: string;
}

export interface IntegranteComiteDto {
    id: string;
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    email: string;
    cargo: string | null;
    estado: string;
    fechaInicio: string;
    fechaFin: string | null;
}

export interface SolicitudComiteBandejaDto {
    id: string;
    numero: string;
    estado: string;
    motivo: string;
    creadoEn: string;
    resueltoEn: string | null;
}

export interface DetalleSolicitudComiteDto {
    solicitud: {
        id: string;
        numero: string;
        estado: string;
        motivo: string;
        resolucion: string | null;
        creadoEn: string;
        resueltoEn: string | null;
    };
    caso: import("@/lib/colegio/seguimiento").DetalleCaso;
    // SPEC-319 §2.4: integrantes ACTIVOS del comité, para el selector de firma del cierre.
    integrantesActivos: { id: string; nombres: string; apellidos: string }[];
}

export interface ResolverSolicitudComiteInput {
    resolucion: string;
    // SPEC-319 §2.4: integrante activo del comité que firma el cierre (cuenta compartida).
    integranteFirmanteId: string;
}

export interface EscalarAlertaInput {
    motivo: string;
}

export interface InfoClienteDto {
    ipAddress: string;
    userAgent: string;
}

/**
 * SPEC-173: home del rol COMITE_CONVIVENCIA. SOLO metadatos de caso
 * (número, categoría, estado, fechas, SLA); nunca texto de reporte ni
 * datos del denunciante.
 */
export interface CasoProximoSlaDto {
    id: string;
    numero: string;
    estado: string;
    categoria: string | null;
    creadoEn: string;
    prioridad: string | null;
    vencimientoSla: string | null;
}

export interface ResumenComiteHomeDto {
    casosAbiertos: number;
    misCasosAsignados: number;
    proximosVencerSla: CasoProximoSlaDto[];
}

export interface EstadisticasComiteDto {
    casosPorEstado: Record<string, number>;
    tiempoMedioResolucionDias: number | null;
    topCategorias: { categoria: string; total: number }[];
    // SPEC-177: bloques aditivos — solo agregados numéricos, cero PII.
    distribucionEstado: DistribucionEstadoComiteDto[];
    tendenciaSemanal: TendenciaSemanalComiteDto[];
    sla: SlaComiteDto;
    tiempoMedioPorCategoria: TiempoMedioCategoriaComiteDto[];
}

/** SPEC-177: distribución por estado con porcentaje sobre el total de casos. */
export interface DistribucionEstadoComiteDto {
    estado: string;
    total: number;
    pct: number;
}

/** SPEC-177: una semana (lunes-domingo, America/Bogota) de la tendencia. */
export interface TendenciaSemanalComiteDto {
    /** Lunes de la semana como fecha ISO "YYYY-MM-DD". */
    semanaInicio: string;
    creados: number;
    resueltos: number;
}

/**
 * SPEC-177: cumplimiento del SLA de los casos del comité.
 * `pctATiempo` es null cuando no hay casos con fecha límite evaluable.
 */
export interface SlaComiteDto {
    aTiempo: number;
    vencidos: number;
    sinSla: number;
    pctATiempo: number | null;
}

/** SPEC-177: días promedio de resolución por categoría (con ≥1 resuelto). */
export interface TiempoMedioCategoriaComiteDto {
    categoria: string;
    dias: number;
    resueltos: number;
}
