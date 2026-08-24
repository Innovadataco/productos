/**
 * SPEC-237 (002-PI-mega-cola): DTOs de la vista de consolidación del comité.
 * Espejo de lo que devuelve `obtenerDetalleConsolidacion` (servicio) y
 * `GET /api/admin/comite/consolidacion/[expedienteId]`.
 */

export type ColorSla = "pino" | "ambar" | "rubi";

export interface SlaDto {
    fechaLimite: string;
    color: ColorSla;
    vencido: boolean;
}

export interface AprobacionDto {
    miembroId: string;
    nombre: string;
    aprobadoEn: string;
}

export interface CorreccionMetaDto {
    miembroId: string;
    nombre: string;
    motivo: string;
    corregidoEn: string;
}

export interface EventoExpedienteDto {
    id: string;
    ordenSecuencial: number;
    fecha: string;
    descripcion: string;
    categoriaDetectada: string | null;
    plataforma: string | null;
}

export interface PatronDto {
    id: string;
    tipo: string;
    severidad: string;
    descripcion: string;
    nivelConfianza: number;
}

export interface GuiaDisponibleDto {
    id: string;
    categoria: string;
    nombre: string;
}

/** Agregados comunitarios (SPEC-234); nunca textos ni datos personales. */
export type SenalComunitariaDto = Record<string, unknown>;

export interface DetalleConsolidacionDto {
    informe: {
        id: string;
        expedienteId: string;
        estadoAprobacion: string;
        resumenTextoGenerado: string;
        guiaAccionCategoriaIdPrincipal: string | null;
        aprobaciones: AprobacionDto[];
        correcciones: CorreccionMetaDto[];
        motivoDevolucion: string | null;
        aprobacionesRequeridas: number;
        createdAt: string;
        updatedAt: string;
    };
    expediente: {
        id: string;
        estado: string;
        identificadorPrincipal: string;
        categoriaDominante: string | null;
        scoreGravedadActual: string;
        numEventos: number;
        fechaApertura: string;
        sla: SlaDto;
        eventos: EventoExpedienteDto[];
    };
    patrones: PatronDto[];
    senalComunitaria: SenalComunitariaDto | null;
    guiasDisponibles: GuiaDisponibleDto[];
}
