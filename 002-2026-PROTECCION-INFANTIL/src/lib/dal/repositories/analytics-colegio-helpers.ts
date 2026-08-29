/**
 * SPEC-194 (002-PI-088): helpers de agregación para analítica de colegios.
 * Funciones puras de BD con Prisma; la lógica de negocio (hallazgos/semáforo)
 * vive en src/lib/analytics/hallazgos-colegio.ts.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { DbClient } from "../unit-of-work";
import type {
    SerieTemporalPunto,
    TopIdentificadorItem,
    MetricasComite,
    MetricasAlertas,
    ComparacionMetrica,
} from "./analytics-colegio-types";

function inicioVentana(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function contarTamañoColegio(colegioId: string, db: DbClient = prisma) {
    const [alumnos, profesores, cursos, materias] = await Promise.all([
        db.estudiante.count({ where: { colegioId, estado: "activo" } }),
        db.profesor.count({ where: { colegioId, estado: "activo" } }),
        db.curso.count({ where: { colegioId, estado: "activo" } }),
        db.materia.count({ where: { colegioId, estado: "activo" } }),
    ]);
    return { alumnos, profesores, cursos, materias };
}

export async function metricasReportesColegio(tenantId: string | null, periodoDias: number, db: DbClient = prisma) {
    if (!tenantId) {
        return {
            total: 0,
            periodo: 0,
            diasDesdeUltimoReporte: null,
            serie: [] as SerieTemporalPunto[],
            porClasificacion: [] as { categoria: string; total: number }[],
            topIdentificadores: [] as TopIdentificadorItem[],
            spamTotal: 0,
            spamPct: 0,
        };
    }

    const baseWhere: Prisma.ReporteWhereInput = { tenantId, eliminado: false };
    const inicio = inicioVentana(periodoDias);

    const [total, periodo, ultimoReporte, serieRaw, porClasificacionRaw, topRaw] = await Promise.all([
        db.reporte.count({ where: baseWhere }),
        db.reporte.count({ where: { ...baseWhere, creadoEn: { gte: inicio } } }),
        db.reporte.findFirst({ where: baseWhere, orderBy: { creadoEn: "desc" }, select: { creadoEn: true } }),
        db.$queryRaw<
            { dia: Date; total: bigint }[]
        >`SELECT DATE("creadoEn") AS dia, COUNT(*) AS total FROM "Reporte" WHERE "tenantId" = ${tenantId} AND eliminado = false AND "creadoEn" >= ${inicio} GROUP BY DATE("creadoEn") ORDER BY dia`,
        db.$queryRaw<
            { categoria: string; total: bigint }[]
        >`SELECT c.categoria, COUNT(*) AS total FROM "Reporte" r LEFT JOIN "ClasificacionIA" c ON c."reporteId" = r.id WHERE r."tenantId" = ${tenantId} AND r.eliminado = false AND r."creadoEn" >= ${inicio} GROUP BY c.categoria ORDER BY total DESC`,
        db.$queryRaw<
            { identificador: string; plataforma: string; total: bigint }[]
        >`SELECT r.identificador, p.nombre AS plataforma, COUNT(*) AS total FROM "Reporte" r LEFT JOIN "Plataforma" p ON p.id = r."plataformaId" WHERE r."tenantId" = ${tenantId} AND r.eliminado = false AND r."creadoEn" >= ${inicio} GROUP BY r.identificador, p.nombre ORDER BY total DESC LIMIT 5`,
    ]);

    const serie: SerieTemporalPunto[] = serieRaw.map((r) => ({
        fecha: r.dia.toISOString().split("T")[0],
        total: Number(r.total),
    }));

    const porClasificacion = porClasificacionRaw
        .filter((r) => r.categoria)
        .map((r) => ({ categoria: r.categoria, total: Number(r.total) }));

    const topIdentificadores: TopIdentificadorItem[] = topRaw.map((r) => ({
        identificador: r.identificador,
        plataforma: r.plataforma || "Desconocida",
        total: Number(r.total),
    }));

    const spamWhere: Prisma.ReporteWhereInput = {
        tenantId,
        eliminado: false,
        estado: "POSIBLE_SPAM",
    };
    const spamTotal = await db.reporte.count({ where: spamWhere });
    const spamPct = total > 0 ? spamTotal / total : 0;

    const diasDesdeUltimoReporte = ultimoReporte?.creadoEn
        ? Math.floor((Date.now() - ultimoReporte.creadoEn.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return { total, periodo, diasDesdeUltimoReporte, serie, porClasificacion, topIdentificadores, spamTotal, spamPct };
}

export async function metricasComiteColegio(colegioId: string, db: DbClient = prisma): Promise<MetricasComite> {
    const comite = await db.usuario.findUnique({
        where: { comiteColegioId: colegioId },
        select: { id: true },
    });
    const comiteId = comite?.id;

    const [integrantesActivos, casosEscaladosRaw, casosResueltosRaw, ultimosCasosRaw] = await Promise.all([
        comiteId ? db.integranteComite.count({ where: { comiteId, estado: "ACTIVO" } }) : 0,
        db.solicitudComite.count({ where: { colegioId } }),
        db.solicitudComite.count({ where: { colegioId, resueltoEn: { not: null } } }),
        db.solicitudComite.findMany({
            where: { colegioId },
            orderBy: { creadoEn: "desc" },
            take: 5,
            select: { numero: true, estado: true, creadoEn: true, resueltoEn: true },
        }),
    ]);

    let tiempoPromedioResolucionHoras: number | null = null;
    if (casosResueltosRaw > 0) {
        const resueltos = await db.solicitudComite.findMany({
            where: { colegioId, resueltoEn: { not: null } },
            select: { creadoEn: true, resueltoEn: true },
        });
        const horas = resueltos
            .filter((r): r is typeof r & { resueltoEn: Date } => r.resueltoEn !== null)
            .map((r) => (r.resueltoEn.getTime() - r.creadoEn.getTime()) / (1000 * 60 * 60));
        tiempoPromedioResolucionHoras = horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null;
    }

    return {
        integrantesActivos,
        casosEscalados: casosEscaladosRaw,
        casosResueltos: casosResueltosRaw,
        tiempoPromedioResolucionHoras,
        ultimosCasos: ultimosCasosRaw.map((c) => ({
            numero: c.numero,
            estado: c.estado,
            creadoEn: c.creadoEn.toISOString(),
            resueltoEn: c.resueltoEn?.toISOString() ?? null,
        })),
    };
}

export async function metricasAlertasColegio(colegioId: string, db: DbClient = prisma): Promise<MetricasAlertas> {
    const [total, resueltas, ultimas] = await Promise.all([
        db.alertaColegio.count({ where: { colegioId } }),
        db.alertaColegio.count({ where: { colegioId, estado: "cerrada" } }),
        db.alertaColegio.findMany({
            where: { colegioId },
            orderBy: { creadoEn: "desc" },
            take: 5,
            select: { id: true, estado: true, tipoSujeto: true, creadoEn: true },
        }),
    ]);

    return {
        total,
        resueltas,
        ultimasAlertas: ultimas.map((a) => ({
            id: a.id,
            estado: a.estado,
            tipoSujeto: a.tipoSujeto,
            creadoEn: a.creadoEn.toISOString(),
        })),
    };
}

export async function calcularComparacionMedia(
    colegioId: string,
    metricasPropias: { alumnos: number; profesores: number; reportesTotal: number; reportesUltimos30Dias: number },
    db: DbClient = prisma
): Promise<{ metricas: ComparacionMetrica[]; insuficientes: boolean }> {
    const colegiosActivos = await db.colegio.findMany({
        where: { estado: "activo" },
        select: { id: true, tenantId: true },
    });

    if (colegiosActivos.length < 3) {
        return { metricas: [], insuficientes: true };
    }

    const otros = colegiosActivos.filter((c) => c.id !== colegioId);
    if (otros.length < 2) {
        return { metricas: [], insuficientes: true };
    }

    const datos = await Promise.all(
        otros.map(async (c) => ({
            alumnos: await db.estudiante.count({ where: { colegioId: c.id, estado: "activo" } }),
            profesores: await db.profesor.count({ where: { colegioId: c.id, estado: "activo" } }),
            reportesTotal: await db.reporte.count({ where: { tenantId: c.tenantId, eliminado: false } }),
            reportesUltimos30Dias: await db.reporte.count({
                where: { tenantId: c.tenantId, eliminado: false, creadoEn: { gte: inicioVentana(30) } },
            }),
        }))
    );

    function mediana(values: number[]): number | null {
        if (values.length === 0) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    const metricas: ComparacionMetrica[] = [
        { nombre: "Alumnos", valorColegio: metricasPropias.alumnos, mediana: mediana(datos.map((d) => d.alumnos)) },
        { nombre: "Profesores", valorColegio: metricasPropias.profesores, mediana: mediana(datos.map((d) => d.profesores)) },
        { nombre: "Reportes totales", valorColegio: metricasPropias.reportesTotal, mediana: mediana(datos.map((d) => d.reportesTotal)) },
        { nombre: "Reportes últimos 30 días", valorColegio: metricasPropias.reportesUltimos30Dias, mediana: mediana(datos.map((d) => d.reportesUltimos30Dias)) },
    ];

    return { metricas, insuficientes: false };
}
