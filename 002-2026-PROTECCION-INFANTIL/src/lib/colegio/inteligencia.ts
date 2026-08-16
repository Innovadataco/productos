/**
 * SPEC-167 (FR-004) — Inteligencia del colegio: DTO único que agrupa
 * estadísticas, tendencia, reloj 24 h, patrones institucionales y comparativa
 * por grado. No expone PII; todos los agregados son colegio-scoped.
 */
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import type { PuntoTendencia } from "@/lib/dal/repositories/colegio-resumen";
import { calcularComparativaCursos, type ComparativaCursos } from "./comparativa";
import { calcularEstadisticasColegio, type EstadisticasColegio, type EstadisticasCurso } from "./estadisticas";
import { obtenerPatronesColegio, type PatronesColegioDto } from "./patrones";
import { periodoTrimestre } from "./patrones";

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioSemanaUTC(fecha: Date): Date {
    const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
    const desplazamiento = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - desplazamiento * DIA_MS);
}

function inicioMesUTC(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

function inicioAnioUTC(fecha: Date): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
}

function ultimosPeriodos(desde: Date, cantidad: number, pasoMs: number): Date[] {
    return Array.from({ length: cantidad }, (_, i) => new Date(desde.getTime() - (cantidad - 1 - i) * pasoMs));
}

function rellenarSerie(filas: { periodo: Date; reportes: number }[], inicios: Date[]): PuntoTendencia[] {
    const porInicio = new Map(filas.map((f) => [new Date(f.periodo).getTime(), f.reportes]));
    return inicios.map((inicio) => ({
        periodo: inicio.toISOString(),
        reportes: porInicio.get(inicio.getTime()) ?? 0,
    }));
}

export interface TendenciaInteligencia {
    semanal: PuntoTendencia[];
    mensual: PuntoTendencia[];
    anual: PuntoTendencia[];
}

export interface EstadisticasInteligenciaColegio {
    colegioId: string;
    colegioNombre: string;
    totales: {
        cursos: number;
        profesores: number;
        estudiantes: number;
        identificadores: number;
        alertas: number;
    };
    porCurso: EstadisticasCurso[];
    tendencia: TendenciaInteligencia;
    reloj24h: number[];
    patrones: PatronesColegioDto;
    comparativa: ComparativaCursos;
}

/**
 * Devuelve el DTO de inteligencia del colegio en una sola llamada orquestada.
 * Las queries de agregado corren en paralelo; no hay N+1.
 */
export async function calcularInteligenciaColegio(colegioId: string): Promise<EstadisticasInteligenciaColegio> {
    const colegio = await new ColegioRepository().obtenerResumen(colegioId);
    if (!colegio) {
        throw new Error("Colegio no encontrado");
    }

    const ahora = new Date();
    const semanas = ultimosPeriodos(inicioSemanaUTC(ahora), 12, 7 * DIA_MS);
    const meses = ultimosPeriodos(inicioMesUTC(ahora), 12, 30 * DIA_MS);
    const anios = Array.from({ length: 3 }, (_, i) => new Date(Date.UTC(ahora.getUTCFullYear() - 2 + i, 0, 1)));

    const alertaRepo = new AlertaColegioRepository();

    const [estadisticas, serieSemanal, serieMensual, serieAnual, reloj24h, patrones, comparativa] = await Promise.all([
        calcularEstadisticasColegio(colegioId),
        alertaRepo.serieReportesPorPeriodo(colegioId, "week", semanas[0]!),
        alertaRepo.serieReportesPorPeriodo(colegioId, "month", meses[0]!),
        alertaRepo.serieReportesPorPeriodo(colegioId, "year", anios[0]!),
        alertaRepo.reloj24h(colegioId),
        obtenerPatronesColegio(colegioId, periodoTrimestre(ahora)),
        calcularComparativaCursos(colegioId, "grado"),
    ]);

    return {
        colegioId: estadisticas.colegioId,
        colegioNombre: estadisticas.colegioNombre,
        totales: {
            cursos: estadisticas.totales.cursos,
            profesores: estadisticas.totales.profesores,
            estudiantes: estadisticas.totales.alumnos,
            identificadores: estadisticas.totales.identificadores,
            alertas: estadisticas.totales.alertas,
        },
        porCurso: estadisticas.porCurso,
        tendencia: {
            semanal: rellenarSerie(serieSemanal, semanas),
            mensual: rellenarSerie(serieMensual, meses),
            anual: rellenarSerie(serieAnual, anios),
        },
        reloj24h,
        patrones,
        comparativa,
    };
}
