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
