/**
 * SPEC-605 · Tipos y selects del DTO del expediente del padre.
 * Separado de `index.ts` por la regla de 500 líneas; la lógica pura vive en
 * `armado.ts` y las consultas en `index.ts`.
 */
import type { CategoriaConducta, EstadoExpediente, EstadoReporte, Prisma } from "@prisma/client";

export type UrgenciaExpediente = "alta" | "media" | "baja" | "sin_clasificar";

export type EstadoReportesExpediente = "EN_PROCESO" | "PROCESADO";

export interface HijoResumenDto {
    nombre: string;
    /** Edad derivada del año de nacimiento (SPEC-604 US2); null si la ficha no lo tiene. */
    edad: number | null;
}

export interface ExpedienteListaItemDto {
    expedienteId: string;
    /** Código corto para mostrar (p. ej. «EXP-2231»); derivado del id, estable. */
    codigo: string;
    identificador: string;
    plataforma: string;
    estado: EstadoExpediente;
    estadoLabel: string;
    hijo: HijoResumenDto | null;
    urgencia: UrgenciaExpediente;
    clasificacionDominante: string | null;
    eventosTuyos: number;
    /** Familias DISTINTAS de la tuya que reportaron la misma cuenta. */
    otrasFamilias: number;
    totalReportes: number;
    ultimaActividad: Date;
    cerrado: boolean;
}

export interface TimelineItemDto {
    /** Fecha del hecho (fechaIncidente); la UI la muestra sin minutos (A-70 · G20). */
    fecha: Date;
    esPropio: boolean;
    categoriaLabel: string | null;
    /** Severidad de la categoría del ítem (color del punto); null sin clasificar. */
    nivel: "alta" | "media" | "baja" | null;
    /** El primer reporte propio del expediente («Primer reporte de este expediente»). */
    esPrimero: boolean;
    /** Solo propios: permite pedir el texto por la vía con step-up. */
    reporteId: string | null;
    /** Solo propios: estado del reporte (para «en proceso» honesto). */
    estadoReporte: EstadoReporte | null;
    /** Blindados: cuántas familias agrupa este evento (1 en los propios). */
    familias: number;
    /** Blindados: ciudades del grupo (vacío en los propios). */
    ciudades: string[];
}

export interface EventoEvidenciaDto {
    reporteId: string;
    fecha: Date;
    categoriaLabel: string | null;
    /** Severidad de la categoría del evento (color del chip); null sin clasificar. */
    nivel: "alta" | "media" | "baja" | null;
    estadoReporte: EstadoReporte;
}

export interface AnalisisExpedienteDto {
    clasificacionDominante: string;
    /** Confianza 0..1 del PROPIO más reciente con la categoría dominante; null
     * cuando la dominante viene solo de la comunidad (la UI no pinta un % falso). */
    confianza: number | null;
    /** true cuando la clasificó una persona (SPEC-359 · B2), no el motor. */
    revisadoPorPersona: boolean;
    tambienConsidero: string[];
    /** Explicación parametrizada por categoría (padre.analisis.explicacion.*). */
    queSignifica: string | null;
}

export interface TendenciaExpedienteDto {
    direccion: "subiendo" | "estable" | "bajando";
    nuevosUltimos7: number;
    previos7: number;
    texto: string;
}

export interface SemaforoExpedienteDto {
    nivel: UrgenciaExpediente;
    titulo: string;
    explicacion: string;
}

export interface ExpedienteDetalleDto {
    expediente: {
        id: string;
        codigo: string;
        identificador: string;
        plataforma: string;
        estado: EstadoExpediente;
        estadoLabel: string;
        fechaApertura: Date;
        ultimoEventoEn: Date | null;
    };
    hijo: HijoResumenDto | null;
    /** Reporte propio que abrió la cadena (base de «+ Agregar evento»); null solo en expedientes sin reportes propios. */
    reportePrincipalId: string | null;
    estadoReportes: EstadoReportesExpediente;
    /** Cuántos eventos propios siguen en cola del motor (PENDIENTE/PROCESANDO). */
    procesando: number;
    semaforo: SemaforoExpedienteDto;
    /** Propios + blindados, cronológica descendente. */
    timeline: TimelineItemDto[];
    evidencia: EventoEvidenciaDto[];
    analisis: AnalisisExpedienteDto | null;
    tendencia: TendenciaExpedienteDto;
    ficha: {
        eventosTotales: number;
        tuyos: number;
        familiasQueReportan: number;
        estadoLabel: string;
        plataforma: string;
        menor: string | null;
        abierto: Date;
    };
}

export interface EstadoFrescoExpedienteDto {
    estadoExpediente: EstadoExpediente;
    estadoLabel: string;
    estadoReportes: EstadoReportesExpediente;
    procesando: number;
    ultimoEventoEn: Date | null;
    actualizadoEn: Date;
}

/* ------------------------- Filas y selects internos ------------------------- */

export const ESTADOS_EN_PROCESO: readonly EstadoReporte[] = ["PENDIENTE", "PROCESANDO"];
export const ESTADOS_FINALES: readonly EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];

export type ReportePropioRow = Prisma.ReporteGetPayload<{
    select: {
        id: true;
        identificador: true;
        fechaIncidente: true;
        creadoEn: true;
        estado: true;
        hijoId: true;
        hijo: { select: { nombre: true; apellidos: true; anioNacimiento: true } };
        plataforma: { select: { nombre: true; clave: true } };
        otraPlataforma: true;
        clasificacion: {
            select: { categoria: true; confianza: true; categoriasSecundarias: true; modeloUsado: true };
        };
    };
}>;

export type ReporteAjenoRow = Prisma.ReporteGetPayload<{
    select: {
        id: true;
        identificador: true;
        fechaIncidente: true;
        creadoEn: true;
        usuarioId: true;
        esAnonimo: true;
        ciudad: true;
        ciudadRel: { select: { nombre: true } };
        clasificacion: { select: { categoria: true } };
    };
}>;

export const SELECT_PROPIO = {
    id: true,
    identificador: true,
    fechaIncidente: true,
    creadoEn: true,
    estado: true,
    hijoId: true,
    hijo: { select: { nombre: true, apellidos: true, anioNacimiento: true } },
    plataforma: { select: { nombre: true, clave: true } },
    otraPlataforma: true,
    clasificacion: {
        select: { categoria: true, confianza: true, categoriasSecundarias: true, modeloUsado: true },
    },
} as const;

export const SELECT_AJENO = {
    id: true,
    identificador: true,
    fechaIncidente: true,
    creadoEn: true,
    usuarioId: true,
    esAnonimo: true,
    ciudad: true,
    ciudadRel: { select: { nombre: true } },
    clasificacion: { select: { categoria: true } },
} as const;

export interface ClasificacionContable {
    categoria: CategoriaConducta;
    confianza: number | null;
    categoriasSecundarias: unknown;
    modeloUsado: string | null;
    fecha: Date;
}
