/**
 * SPEC-143 — ColegioResumenRepository: UNA llamada `homeRector(colegioId)` alimenta
 * TODA la home operativa del rector (FR-002). Todas las consultas salen en
 * Promise.all (conteos/agregados y groupBys, cero N+1 por construcción) y cada
 * conteo lleva el tenant (`colegioId` directo o vía estudiante, patrón E-1).
 *
 * Métrica D2 (ZEUS): "reportes" = COUNT(DISTINCT reporteId) de AlertaColegio — un
 * reporte que toca a N estudiantes del colegio cuenta UNA vez (KPI, delta, series
 * y top de cursos usan la MISMA métrica).
 *
 * I-29: el DTO no contiene scores, categorías técnicas ni textos — solo conteos
 * agregados del propio colegio y nombres de curso/profesor.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { leerHeartbeatWorker } from "@/lib/worker-heartbeat";
import type { DbClient } from "../unit-of-work";
import { ColegioRepository } from "./colegio";
import { CursoRepository } from "./curso";
import { EstudianteRepository } from "./estudiante";
import { ProfesorRepository } from "./profesor";
import { AlertaColegioRepository } from "./alerta-colegio";

export interface PuntoTendencia {
    /** Fecha ISO de inicio del periodo (lunes / día 1 / 1 de enero, en UTC). */
    periodo: string;
    reportes: number;
}

export interface CursoMirada {
    cursoId: string;
    nombre: string;
    /** "María López" o null → la UI muestra "sin titular asignado". */
    profesorTitular: string | null;
    /** Reportes DISTINTOS (D2) de los últimos 30 días. */
    alertas30d: number;
}

export interface HomeRector {
    colegio: { nombre: string; vigenciaFin: Date | null };
    kpis: {
        estudiantes: number;
        cursos: number;
        profesores: number;
        reportesMes: number;
        reportesSemana: number;
        deltaSemana: number;
    };
    cobertura: {
        vigilancia: number;
        reaccion: number;
        sinRedes: number;
        sinContacto: number;
    };
    semaforo: { alertasNuevas: number; alertas72h: number };
    ultimaSenal: Date | null;
    latidoSistema: Date | null;
    tendencia: {
        semanal: PuntoTendencia[];
        mensual: PuntoTendencia[];
        anual: PuntoTendencia[];
    };
    cursosMirada: CursoMirada[];
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Lunes 00:00 UTC de la semana de `fecha` (alineado con date_trunc('week')). */
function inicioSemanaUTC(fecha: Date): Date {
    const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
    const desplazamiento = (d.getUTCDay() + 6) % 7; // lunes = 0
    return new Date(d.getTime() - desplazamiento * DIA_MS);
}

/** Rellena los huecos con ceros: devuelve exactamente los últimos `cantidad` periodos. */
function rellenarSerie(
    filas: { periodo: Date; reportes: number }[],
    inicios: Date[]
): PuntoTendencia[] {
    const porInicio = new Map(filas.map((f) => [new Date(f.periodo).getTime(), f.reportes]));
    return inicios.map((inicio) => ({
        periodo: inicio.toISOString(),
        reportes: porInicio.get(inicio.getTime()) ?? 0,
    }));
}

function iniciosSemanales(ahora: Date, cantidad = 12): Date[] {
    const lunesActual = inicioSemanaUTC(ahora);
    return Array.from({ length: cantidad }, (_, i) => new Date(lunesActual.getTime() - (cantidad - 1 - i) * 7 * DIA_MS));
}

function iniciosMensuales(ahora: Date, cantidad = 12): Date[] {
    const base = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - (cantidad - 1), 1));
    return Array.from({ length: cantidad }, (_, i) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1)));
}

function iniciosAnuales(ahora: Date, cantidad = 3): Date[] {
    const anioActual = ahora.getUTCFullYear();
    return Array.from({ length: cantidad }, (_, i) => new Date(Date.UTC(anioActual - (cantidad - 1) + i, 0, 1)));
}

export class ColegioResumenRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Propaga el cliente transaccional a los repos hijos (undefined = singleton). */
    private tx(): Prisma.TransactionClient | undefined {
        return this.db === prisma ? undefined : (this.db as Prisma.TransactionClient);
    }

    /**
     * Todos los datos propios de la home del rector en UNA llamada (consultas en
     * paralelo). 404 si el colegio no existe.
     */
    async homeRector(colegioId: string): Promise<HomeRector> {
        const ahora = new Date();
        const hace7d = new Date(ahora.getTime() - 7 * DIA_MS);
        const hace14d = new Date(ahora.getTime() - 14 * DIA_MS);
        const hace30d = new Date(ahora.getTime() - 30 * DIA_MS);
        const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));

        const semanas = iniciosSemanales(ahora);
        const meses = iniciosMensuales(ahora);
        const anios = iniciosAnuales(ahora);

        const tx = this.tx();
        const colegioRepo = new ColegioRepository(tx);
        const estudianteRepo = new EstudianteRepository(tx);
        const cursoRepo = new CursoRepository(tx);
        const profesorRepo = new ProfesorRepository(tx);
        const alertaRepo = new AlertaColegioRepository(tx);

        const [
            colegio,
            coberturaConteos,
            cursosActivos,
            profesoresActivos,
            reportesMes,
            reportesSemana,
            reportesSemanaAnterior,
            semaforo,
            ultimaSenal,
            serieSemanal,
            serieMensual,
            serieAnual,
            topCursos,
        ] = await Promise.all([
            colegioRepo.obtenerFichaHome(colegioId),
            estudianteRepo.contarCobertura(colegioId),
            cursoRepo.contarActivos(colegioId),
            profesorRepo.contar(colegioId),
            alertaRepo.contarReportesDistintos(colegioId, inicioMes),
            alertaRepo.contarReportesDistintos(colegioId, hace7d),
            alertaRepo.contarReportesDistintos(colegioId, hace14d, hace7d),
            alertaRepo.conteosSemaforo(colegioId),
            alertaRepo.ultimaSenal(colegioId),
            alertaRepo.serieReportesPorPeriodo(colegioId, "week", semanas[0]!),
            alertaRepo.serieReportesPorPeriodo(colegioId, "month", meses[0]!),
            alertaRepo.serieReportesPorPeriodo(colegioId, "year", anios[0]!),
            alertaRepo.topCursosPorReportes(colegioId, hace30d, 3),
        ]);

        if (!colegio) {
            throw new AppError("Colegio no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const cursosInfo = await cursoRepo.obtenerConTitularPorIds(
            colegioId,
            topCursos.map((t) => t.cursoId)
        );
        const infoPorId = new Map(cursosInfo.map((c) => [c.id, c]));

        const cursosMirada: CursoMirada[] = topCursos.flatMap((t) => {
            const info = infoPorId.get(t.cursoId);
            if (!info) return [];
            const titular = info.profesorTitular
                ? `${info.profesorTitular.nombre} ${info.profesorTitular.apellidos}`.trim()
                : null;
            return [{ cursoId: t.cursoId, nombre: info.nombre, profesorTitular: titular || null, alertas30d: t.total }];
        });

        const estudiantesActivos = coberturaConteos.activos;

        return {
            colegio: { nombre: colegio.nombre, vigenciaFin: colegio.finServicio },
            kpis: {
                estudiantes: estudiantesActivos,
                cursos: cursosActivos,
                profesores: profesoresActivos,
                reportesMes,
                reportesSemana,
                deltaSemana: reportesSemana - reportesSemanaAnterior,
            },
            cobertura: {
                vigilancia: estudiantesActivos > 0 ? coberturaConteos.conIdentificadores / estudiantesActivos : 0,
                reaccion: estudiantesActivos > 0 ? coberturaConteos.conAcudientes / estudiantesActivos : 0,
                sinRedes: estudiantesActivos - coberturaConteos.conIdentificadores,
                sinContacto: estudiantesActivos - coberturaConteos.conAcudientes,
            },
            semaforo,
            ultimaSenal,
            latidoSistema: leerHeartbeatWorker(),
            tendencia: {
                semanal: rellenarSerie(serieSemanal, semanas),
                mensual: rellenarSerie(serieMensual, meses),
                anual: rellenarSerie(serieAnual, anios),
            },
            cursosMirada,
        };
    }
}
