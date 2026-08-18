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
}

export interface ResolverSolicitudComiteInput {
    resolucion: string;
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
}
