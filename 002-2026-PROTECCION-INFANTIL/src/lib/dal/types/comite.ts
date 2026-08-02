/**
 * SPEC-053 (US3, módulo Comité): DTOs de la bandeja del comité de validación,
 * las apelaciones del comité (SPEC-110) y el padrón de integrantes.
 */

/** Input de resolución de una solicitud del comité (corrección de categoría). */
export interface ResolverSolicitudInput {
    categoria: string;
    resolucion?: string | undefined;
}

/** Input de resolución de una apelación (SPEC-110). */
export interface ResolverApelacionInput {
    decision: "ACEPTADA" | "RECHAZADA";
    motivacion: string;
    quitarVisibilidad: boolean;
    reportesABajar: string[];
}

/** Input de alta de integrante (numeroIdentificacion en claro; el servicio cifra). */
export interface CrearIntegranteInput {
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: "CEDULA_CIUDADANIA" | "CEDULA_EXTRANJERIA" | "PASAPORTE" | "OTRO";
    numeroIdentificacion: string;
    email: string;
    fechaInicio?: string | undefined;
}

/** Input de edición de integrante (campos opcionales). */
export interface ActualizarIntegranteInput {
    nombres?: string | undefined;
    apellidos?: string | undefined;
    tipoIdentificacion?: "CEDULA_CIUDADANIA" | "CEDULA_EXTRANJERIA" | "PASAPORTE" | "OTRO" | undefined;
    numeroIdentificacion?: string | undefined;
    email?: string | undefined;
    fechaInicio?: string | undefined;
    fechaFin?: string | undefined;
    estado?: "ACTIVO" | "INACTIVO" | undefined;
}
