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
import type { CursoConTitularRow } from "./curso";
import { EstudianteRepository } from "./estudiante";
import type { EstudianteConDetalleRow } from "./estudiante";
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

/** SPEC-147 (FR-002, Key Entities): DTO del escritorio del curso. */
export interface CursoDetalle {
    /** Ficha del curso con su titular (incluye `estado`, COND-2 de SPEC-145). */
    curso: CursoConTitularRow;
    /** Titular con su estado; null → la UI muestra "sin titular asignado". */
    titular: { nombre: string; apellidos: string; estado: string } | null;
    /** Estudiantes ACTIVOS del curso con acudientes (orden asc) e identificadores activos. */
    estudiantes: EstudianteConDetalleRow[];
    /** Cobertura del CURSO (misma fórmula que la home): vigilancia / reacción / huecos. */
    cobertura: { vigilancia: number; reaccion: number; sinRedes: number; sinContacto: number };
    /** Reportes DISTINTOS (D2) del curso en los últimos 30 días. */
    alertas30d: number;
    /** Delta vs los 30 días anteriores (positivo = más reportes). */
    delta30d: number;
    /** Total de identificadores activos del curso (tarjeta "Identificadores"). */
    identificadoresActivos: number;
}

/** SPEC-158 (FR-003, Key Entities): embudo por reporte DISTINTO, sin solapes. */
export interface EmbudoTablero {
    recibidos: number;
    cerrados: number;
    enRevision: number;
    teEsperan: number;
}

/** SPEC-158 (Key Entities): barra por curso (30 días, métrica D2, con nombre). */
export interface BarraCurso {
    cursoId: string;
    nombre: string;
    reportes30d: number;
}

/** SPEC-158 (Key Entities): DTO del tablero de control del colegio. I-29: solo conteos. */
export interface TableroColegio {
    embudo: EmbudoTablero;
    /** Reportes DISTINTOS por hora del día (America/Bogota), 24 posiciones con ceros. */
    reloj24h: number[];
    /** Serie mensual reusada de la home: últimos 12 meses, huecos en cero. */
    ritmoMensual: PuntoTendencia[];
    barrasCurso: BarraCurso[];
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

    /**
     * SPEC-158 (FR-002, SC-003): TODOS los datos del tablero de control en UNA
     * llamada (Promise.all de agregados, cero N+1, tenant en cada query). Reusa
     * la serie mensual (12 puntos) y el top por curso (30 días, límite alto) de
     * la home con la MISMA métrica D2; el embudo y el reloj son agregados
     * propios de `AlertaColegioRepository`. I-29: solo conteos agregados.
     */
    async tableroColegio(colegioId: string): Promise<TableroColegio> {
        const ahora = new Date();
        const hace30d = new Date(ahora.getTime() - 30 * DIA_MS);
        const meses = iniciosMensuales(ahora);

        const tx = this.tx();
        const alertaRepo = new AlertaColegioRepository(tx);
        const cursoRepo = new CursoRepository(tx);

        const [embudo, reloj24h, serieMensual, topCursos] = await Promise.all([
            alertaRepo.embudoPorReporte(colegioId),
            alertaRepo.reloj24h(colegioId),
            alertaRepo.serieReportesPorPeriodo(colegioId, "month", meses[0]!),
            // Límite alto (10): las barras caben en pantalla sin paginar.
            alertaRepo.topCursosPorReportes(colegioId, hace30d, 10),
        ]);

        const cursosInfo = await cursoRepo.obtenerConTitularPorIds(
            colegioId,
            topCursos.map((t) => t.cursoId)
        );
        const infoPorId = new Map(cursosInfo.map((c) => [c.id, c]));

        const barrasCurso: BarraCurso[] = topCursos.flatMap((t) => {
            const info = infoPorId.get(t.cursoId);
            return info ? [{ cursoId: t.cursoId, nombre: info.nombre, reportes30d: t.total }] : [];
        });

        return {
            embudo,
            reloj24h,
            ritmoMensual: rellenarSerie(serieMensual, meses),
            barrasCurso,
        };
    }

    /**
     * SPEC-147 (FR-002, SC-001): TODOS los datos del escritorio del curso en UNA
     * llamada (consultas en paralelo, cero N+1). 404 si el curso no existe o es
     * de OTRO colegio (tenant-first E-1). I-29: solo conteos, cero scores.
     */
    async cursoDetalle(colegioId: string, cursoId: string): Promise<CursoDetalle> {
        const ahora = new Date();
        const hace30d = new Date(ahora.getTime() - 30 * DIA_MS);
        const hace60d = new Date(ahora.getTime() - 60 * DIA_MS);

        const tx = this.tx();
        const cursoRepo = new CursoRepository(tx);
        const estudianteRepo = new EstudianteRepository(tx);
        const alertaRepo = new AlertaColegioRepository(tx);

        const [cursos, estudiantes, coberturaConteos, alertas30d, alertas30dPrevias] = await Promise.all([
            cursoRepo.obtenerConTitularPorIds(colegioId, [cursoId]),
            estudianteRepo.listarPorCursoConDetalle(colegioId, cursoId),
            estudianteRepo.contarCobertura(colegioId, cursoId),
            alertaRepo.contarReportesDistintosPorCurso(colegioId, cursoId, hace30d),
            alertaRepo.contarReportesDistintosPorCurso(colegioId, cursoId, hace60d, hace30d),
        ]);

        const curso = cursos[0];
        if (!curso) {
            throw new AppError("Curso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const activos = coberturaConteos.activos;

        return {
            curso,
            titular: curso.profesorTitular,
            estudiantes,
            cobertura: {
                vigilancia: activos > 0 ? coberturaConteos.conIdentificadores / activos : 0,
                reaccion: activos > 0 ? coberturaConteos.conAcudientes / activos : 0,
                sinRedes: activos - coberturaConteos.conIdentificadores,
                sinContacto: activos - coberturaConteos.conAcudientes,
            },
            alertas30d,
            delta30d: alertas30d - alertas30dPrevias,
            // Sin query extra: los identificadores activos ya vienen en el include.
            identificadoresActivos: estudiantes.reduce((total, e) => total + e.identificadores.length, 0),
        };
    }
}
