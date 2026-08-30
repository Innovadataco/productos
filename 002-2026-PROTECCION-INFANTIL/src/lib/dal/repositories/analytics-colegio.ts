/**
 * SPEC-194 (002-PI-088): repositorio de analítica de colegios.
 * Solo lectura + agregaciones. Nunca expone texto de reportes ni datos de menores.
 */

import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import { calcularHallazgos } from "@/lib/analytics/hallazgos-colegio";
import { cargarParametrosAnalytics } from "@/lib/analytics/parametros";
import type { ParametrosAnalyticsColegios } from "@/lib/analytics/parametros";
import type {
    FiltrosResumenColegios,
    ColegioResumenItem,
    ColegioDetalleResponse,
    UmbralesSemaforoDTO,
    DistribucionRolReportante,
    OperadorAsignado,
    LineaTiempoColegio,
    PuntoSerieMensual,
} from "./analytics-colegio-types";
import {
    contarTamañoColegio,
    metricasReportesColegio,
    metricasComiteColegio,
    metricasAlertasColegio,
    calcularComparacionMedia,
} from "./analytics-colegio-helpers";
import { ColegioActividadRepository } from "./colegio-actividad";

// SPEC-303 (002-PI-209): DTO de umbrales derivado de ParametrosAnalyticsColegios.
function umbralesADTO(u: ParametrosAnalyticsColegios): UmbralesSemaforoDTO {
    return {
        casosAbiertosAlto: u.casosAbiertosAlto,
        casosSinMovimientoDias: u.casosSinMovimientoDias,
        porcentajeProcesadoMin: u.porcentajeProcesadoMin,
        inactividadAlertaDias: u.inactividadAlertaDias,
        spamAlertaPct: u.spamAlertaPct,
        resolucionComiteOkPct: u.resolucionComiteOkPct,
        periodoDefaultDias: u.periodoDefaultDias,
    };
}

// SPEC-303 (002-PI-209): motivo corto (≤ 60 chars) del hallazgo negativo con mayor peso.
// Si no hay hallazgos negativos, devuelve null (colegio verde).
function pickMotivoNoVerde(negativos: string[]): string | null {
    if (negativos.length === 0) return null;
    const primero = negativos[0] ?? null;
    if (!primero) return null;
    return primero.length <= 60 ? primero : `${primero.slice(0, 57)}…`;
}

// SPEC-303 (002-PI-209): rango últimos N días con base en el default configurado.
function rangoUltimosDias(dias: number): { desde: Date; hasta: Date } {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 24 * 3600 * 1000);
    return { desde, hasta };
}

export class AnalyticsColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: DbClient) {
        this.db = tx ?? prisma;
    }

    async resumenColegios(
        filtros: FiltrosResumenColegios,
        paginacion: { skip: number; take: number }
    ): Promise<{ items: ColegioResumenItem[]; total: number }> {
        const umbrales = await cargarParametrosAnalytics(this.db);

        const whereBase: { estado?: string; ciudadId?: string; nombre?: { contains: string; mode: "insensitive" } } = {};
        if (filtros.estado) whereBase.estado = filtros.estado;
        if (filtros.ciudadId) whereBase.ciudadId = filtros.ciudadId;
        if (filtros.q) whereBase.nombre = { contains: filtros.q, mode: "insensitive" };

        const [colegios, total] = await Promise.all([
            this.db.colegio.findMany({
                where: whereBase,
                select: {
                    id: true,
                    nombre: true,
                    estado: true,
                    creadoEn: true,
                    tenantId: true,
                    ciudad: { select: { nombre: true } },
                    departamento: { select: { nombre: true } },
                },
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.colegio.count({ where: whereBase }),
        ]);

        const items = await Promise.all(
            colegios.map(async (c) => this.resumenItemDesdeColegio(c, umbrales))
        );

        if (filtros.orden) {
            const dir = filtros.direccion === "desc" ? -1 : 1;
            const campo = filtros.orden;
            items.sort((a, b) => {
                let va: string | number;
                let vb: string | number;
                if (campo === "fechaRegistro") {
                    va = a.fechaRegistro;
                    vb = b.fechaRegistro;
                } else {
                    va = a[campo];
                    vb = b[campo];
                }
                if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
                return ((va as number) - (vb as number)) * dir;
            });
        }

        return { items, total };
    }

    private async resumenItemDesdeColegio(
        colegio: {
            id: string;
            nombre: string;
            estado: string;
            creadoEn: Date;
            tenantId: string;
            ciudad: { nombre: string } | null;
            departamento: { nombre: string } | null;
        },
        umbrales: ParametrosAnalyticsColegios
    ): Promise<ColegioResumenItem> {
        // SPEC-303 (002-PI-209): actividad cruzada por 3 rutas (I-98). Paraleliza con el resto.
        const rangoActividad = rangoUltimosDias(umbrales.periodoDefaultDias);
        const [{ alumnos, profesores }, reportes, actividadReal] = await Promise.all([
            contarTamañoColegio(colegio.id, this.db),
            metricasReportesColegio(colegio.tenantId, umbrales.periodoDefaultDias, this.db),
            new ColegioActividadRepository(this.db).actividadDelColegio(colegio.id, rangoActividad),
        ]);

        const comite = await metricasComiteColegio(colegio.id, this.db);
        const alertas = await metricasAlertasColegio(colegio.id, this.db);

        const casosProcesadosPct = reportes.total > 0
            ? Math.max(0, 1 - (await this.reportesPendientes(colegio.tenantId) / reportes.total))
            : 0;

        const hallazgos = calcularHallazgos(umbrales, {
            reportesTotal: reportes.total,
            reportesPeriodo: reportes.periodo,
            diasDesdeUltimoReporte: reportes.diasDesdeUltimoReporte,
            spamTotal: reportes.spamTotal,
            spamPct: reportes.spamPct,
            comiteIntegrantesActivos: comite.integrantesActivos,
            comiteCasosEscalados: comite.casosEscalados,
            comiteCasosResueltos: comite.casosResueltos,
            comiteTasaResolucion: comite.casosEscalados > 0 ? comite.casosResueltos / comite.casosEscalados : 0,
            alertasSinOperador: alertas.total - alertas.resueltas,
        });

        const negativos = hallazgos.hallazgos.filter((h) => h.tipo === "negativo").map((h) => h.mensaje);
        const motivoNoVerde = hallazgos.semaforo === "verde" ? null : pickMotivoNoVerde(negativos);

        return {
            id: colegio.id,
            nombre: colegio.nombre,
            ciudad: colegio.ciudad?.nombre ?? "—",
            departamento: colegio.departamento?.nombre ?? null,
            fechaRegistro: colegio.creadoEn.toISOString(),
            estado: colegio.estado === "activo" ? "activo" : "inactivo",
            alumnos,
            profesores,
            reportesUltimos30Dias: reportes.periodo,
            reportesTotal: reportes.total,
            alertasEscaladas: comite.casosEscalados,
            casosProcesadosPct,
            semaforo: hallazgos.semaforo,
            // SPEC-303 (002-PI-209): campos aditivos.
            totalReportesActividad: actividadReal.total,
            motivoNoVerde,
        };
    }

    private async reportesPendientes(tenantId: string | null): Promise<number> {
        if (!tenantId) return 0;
        return this.db.reporte.count({
            where: { tenantId, eliminado: false, estado: { in: ["PENDIENTE", "REVISION_MANUAL"] } },
        });
    }

    async detalleColegio(colegioId: string): Promise<ColegioDetalleResponse | null> {
        const colegio = await this.db.colegio.findUnique({
            where: { id: colegioId },
            select: {
                id: true,
                nombre: true,
                tipoPeriodo: true,
                direccion: true,
                creadoEn: true,
                estado: true,
                tenantId: true,
                representanteLegalNombre: true,
                representanteLegalEmail: true,
                ciudad: { select: { nombre: true } },
                departamento: { select: { nombre: true } },
            },
        });
        if (!colegio) return null;

        const umbrales = await cargarParametrosAnalytics(this.db);

        const [tamaño, reportes, comite, alertas] = await Promise.all([
            contarTamañoColegio(colegio.id, this.db),
            metricasReportesColegio(colegio.tenantId, umbrales.periodoDefaultDias, this.db),
            metricasComiteColegio(colegio.id, this.db),
            metricasAlertasColegio(colegio.id, this.db),
        ]);

        const casosProcesadosPct = reportes.total > 0
            ? Math.max(0, 1 - (await this.reportesPendientes(colegio.tenantId) / reportes.total))
            : 0;

        const hallazgos = calcularHallazgos(umbrales, {
            reportesTotal: reportes.total,
            reportesPeriodo: reportes.periodo,
            diasDesdeUltimoReporte: reportes.diasDesdeUltimoReporte,
            spamTotal: reportes.spamTotal,
            spamPct: reportes.spamPct,
            comiteIntegrantesActivos: comite.integrantesActivos,
            comiteCasosEscalados: comite.casosEscalados,
            comiteCasosResueltos: comite.casosResueltos,
            comiteTasaResolucion: comite.casosEscalados > 0 ? comite.casosResueltos / comite.casosEscalados : 0,
            alertasSinOperador: alertas.total - alertas.resueltas,
        });

        const comparacion = await calcularComparacionMedia(
            colegio.id,
            { alumnos: tamaño.alumnos, profesores: tamaño.profesores, reportesTotal: reportes.total, reportesUltimos30Dias: reportes.periodo },
            this.db
        );

        // SPEC-303 (002-PI-209): actividad cruzada por 3 rutas (I-98) para el detalle.
        const rangoActividad = rangoUltimosDias(umbrales.periodoDefaultDias);
        // SPEC-311 (002-PI-210 · Fase 2): rango all-time para lineaTiempo + serieMensual.
        const rangoAllTime = { desde: colegio.creadoEn, hasta: new Date() };
        const [actividadCruzada, actividadAllTime, operadoresAsignados, distribucionRol] = await Promise.all([
            new ColegioActividadRepository(this.db).actividadDelColegio(colegio.id, rangoActividad),
            new ColegioActividadRepository(this.db).actividadDelColegio(colegio.id, rangoAllTime),
            this.obtenerOperadoresAsignados(colegio.id),
            this.obtenerDistribucionRol(colegio.id, rangoActividad),
        ]);
        const lineaTiempo = this.computarLineaTiempo(colegio.creadoEn, actividadAllTime.reportes);
        const serieMensual = this.computarSerieMensual(colegio.creadoEn, actividadAllTime.reportes);

        return {
            id: colegio.id,
            infoBasica: {
                nombre: colegio.nombre,
                tipoPeriodo: colegio.tipoPeriodo,
                ciudad: colegio.ciudad?.nombre ?? "—",
                departamento: colegio.departamento?.nombre ?? null,
                direccion: colegio.direccion,
                fechaRegistro: colegio.creadoEn.toISOString(),
                contactoRector: colegio.representanteLegalNombre
                    ? { nombre: colegio.representanteLegalNombre, email: colegio.representanteLegalEmail }
                    : null,
            },
            metricasTamaño: tamaño,
            actividadReportes: {
                serie30Dias: reportes.serie,
                porClasificacion: reportes.porClasificacion,
                topIdentificadores: reportes.topIdentificadores,
            },
            comite,
            alertas,
            hallazgos: {
                positivos: hallazgos.hallazgos.filter((h) => h.tipo === "positivo").map((h) => h.mensaje),
                negativos: hallazgos.hallazgos.filter((h) => h.tipo === "negativo").map((h) => h.mensaje),
                semaforo: hallazgos.semaforo,
            },
            comparacionMedia: comparacion,
            // SPEC-303 (002-PI-209): bloques nuevos aditivos para cerrar I-98 y I-104.
            actividadReportesCruzada: {
                total: actividadCruzada.total,
                porEstado: actividadCruzada.porEstado as Record<string, number>,
                casosAbiertos: actividadCruzada.casosAbiertos,
                ultimaActividad: actividadCruzada.ultimaActividad?.toISOString() ?? null,
                rango: {
                    desde: rangoActividad.desde.toISOString(),
                    hasta: rangoActividad.hasta.toISOString(),
                    periodoDias: umbrales.periodoDefaultDias,
                },
            },
            umbralesSemaforo: umbralesADTO(umbrales),
            // SPEC-311 (002-PI-210 · Fase 2): 4 bloques aditivos para rediseño 4 bloques A→D.
            distribucionRol,
            operadoresAsignados,
            lineaTiempo,
            serieMensual,
        };
    }

    // SPEC-311 (002-PI-210): DISTINCT Usuarios asignados a AlertaColegio del colegio.
    private async obtenerOperadoresAsignados(colegioId: string): Promise<OperadorAsignado[]> {
        const usuarios = await this.db.usuario.findMany({
            where: { alertasAsignadas: { some: { colegioId } } },
            select: { id: true, nombre: true, email: true },
            orderBy: { nombre: "asc" },
        });
        return usuarios.map((u) => ({ id: u.id, nombre: u.nombre ?? "—", email: u.email }));
    }

    // SPEC-311 (002-PI-210): distribución por rol reportante del rango vigente.
    // Invariante: padre + estudiante + profesor + anonimo === actividadCruzada.total
    private async obtenerDistribucionRol(
        colegioId: string,
        rango: { desde: Date; hasta: Date }
    ): Promise<DistribucionRolReportante> {
        const actividad = await new ColegioActividadRepository(this.db).actividadDelColegio(colegioId, rango);
        const ids = actividad.reportes.map((r) => r.id);
        if (ids.length === 0) return { padre: 0, estudiante: 0, profesor: 0, anonimo: 0 };

        const detalles = await this.db.reporte.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                esAnonimo: true,
                origenRol: true,
                usuario: { select: { rol: true } },
            },
        });

        let padre = 0;
        let profesor = 0;
        let anonimo = 0;
        const estudiante = 0; // sin RolUsuario.STUDENT en el schema actual · reservado (D5 research).
        for (const r of detalles) {
            if (r.origenRol === "PARENT") {
                padre += 1;
            } else if (r.esAnonimo || !r.usuario) {
                anonimo += 1;
            } else if (r.usuario.rol === "PARENT") {
                padre += 1;
            } else if (
                r.usuario.rol === "SCHOOL_ADMIN" ||
                r.usuario.rol === "OPERADOR" ||
                r.usuario.rol === "COMITE_VALIDACION" ||
                r.usuario.rol === "COMITE_CONVIVENCIA"
            ) {
                profesor += 1;
            } else {
                anonimo += 1;
            }
        }
        return { padre, estudiante, profesor, anonimo };
    }

    // SPEC-311 (002-PI-210): línea de tiempo (Bloque C) con hitos derivados de reportes all-time.
    private computarLineaTiempo(
        fechaRegistro: Date,
        reportesAllTime: Array<{ id: string; creadoEn: Date }>
    ): LineaTiempoColegio {
        const hoy = new Date();
        if (reportesAllTime.length === 0) {
            return {
                fechaRegistro: fechaRegistro.toISOString(),
                primerReporte: null,
                picoActividad: null,
                hoy: hoy.toISOString(),
            };
        }
        let minTs = reportesAllTime[0]!.creadoEn.getTime();
        const buckets = new Map<string, number>();
        for (const r of reportesAllTime) {
            const ts = r.creadoEn.getTime();
            if (ts < minTs) minTs = ts;
            const anioMes = r.creadoEn.toISOString().slice(0, 7);
            buckets.set(anioMes, (buckets.get(anioMes) ?? 0) + 1);
        }
        // Empate → mes más reciente (lexicográfico max cuando coinciden totales).
        let pico: { anioMes: string; total: number } | null = null;
        for (const [anioMes, total] of buckets) {
            if (!pico || total > pico.total || (total === pico.total && anioMes > pico.anioMes)) {
                pico = { anioMes, total };
            }
        }
        return {
            fechaRegistro: fechaRegistro.toISOString(),
            primerReporte: new Date(minTs).toISOString(),
            picoActividad: pico,
            hoy: hoy.toISOString(),
        };
    }

    // SPEC-311 (002-PI-210): serie mensual (Bloque B) all-time con relleno de meses vacíos.
    private computarSerieMensual(
        fechaRegistro: Date,
        reportesAllTime: Array<{ id: string; creadoEn: Date }>
    ): PuntoSerieMensual[] {
        const buckets = new Map<string, number>();
        for (const r of reportesAllTime) {
            const anioMes = r.creadoEn.toISOString().slice(0, 7);
            buckets.set(anioMes, (buckets.get(anioMes) ?? 0) + 1);
        }
        if (buckets.size === 0) return [];
        // Rellenar meses vacíos entre el primerReporte (o fechaRegistro) y hoy.
        const sortedKeys = [...buckets.keys()].sort();
        const primeraClave = sortedKeys[0]!;
        const [pAnio, pMes] = primeraClave.split("-").map(Number);
        const fechaInicio = new Date(pAnio!, pMes! - 1, 1);
        const hoy = new Date();
        const serie: PuntoSerieMensual[] = [];
        const cursor = new Date(fechaInicio);
        while (cursor <= hoy) {
            const anioMes = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
            serie.push({ anioMes, total: buckets.get(anioMes) ?? 0 });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        void fechaRegistro; // fechaRegistro no se usa hoy (se conserva por si se decide "desde ingreso").
        return serie;
    }
}
