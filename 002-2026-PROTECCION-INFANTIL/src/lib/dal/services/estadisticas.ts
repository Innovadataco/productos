/**
 * SPEC-053 (US3, módulo Estadísticas): EstadisticasService.
 * Agregaciones del dashboard público y del panel admin (incluida la tabla
 * operativa de clasificación). Las raw queries viven en `EstadisticasRepository`
 * (D3); los predicados de acceso en `src/lib/reportes-acceso.ts` (SPEC-122).
 * I-29 (SPEC-108): NUNCA scorePromedio en la API pública. Acepta tx opcional (D2).
 */
import type { AccionAudit, Prisma } from "@prisma/client";
import { obtenerGruposCategoria, agruparCategorias } from "@/lib/categoria-grupos";
import { getWorkerMetrics } from "@/lib/queue-metrics";
import {
    whereReporteAprobado,
    whereReporteVigente,
    whereReporteEnEstado,
    whereReporteEnEstados,
    ESTADOS_APROBADOS,
    CATEGORIAS_NO_APROBADAS,
} from "@/lib/reportes-acceso";
import { EstadisticasRepository } from "../repositories/estadisticas";
import { ReporteRepository } from "../repositories/reporte";
import { PlataformaRepository } from "../repositories/plataforma";
import { CiudadRepository } from "../repositories/ciudad";
import { CorreccionAdminRepository } from "../repositories/correccion-admin";
import { AuditLogRepository } from "../repositories/audit-log";
import { UsuarioRepository } from "../repositories/usuario";

const ACCIONES_CIERRE: AccionAudit[] = ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA"];

function startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function calcularPrecisionPorCategoria(
    confirmaciones: { categoriaOriginal: string; _count: { categoriaOriginal: number } }[],
    correcciones: { categoriaOriginal: string; _count: { categoriaOriginal: number } }[]
) {
    const confirmadasMap = new Map<string, number>();
    for (const c of confirmaciones) {
        confirmadasMap.set(c.categoriaOriginal, c._count.categoriaOriginal);
    }
    const corregidasMap = new Map<string, number>();
    for (const c of correcciones) {
        corregidasMap.set(c.categoriaOriginal, c._count.categoriaOriginal);
    }

    const categorias = new Set([...confirmadasMap.keys(), ...corregidasMap.keys()]);
    return Array.from(categorias).map((categoria) => {
        const confirmadas = confirmadasMap.get(categoria) || 0;
        const corregidas = corregidasMap.get(categoria) || 0;
        const totalRevisados = confirmadas + corregidas;
        return {
            categoria,
            confirmadas,
            corregidas,
            totalRevisados,
            precisionObservada: totalRevisados === 0 || totalRevisados < 5 ? null : confirmadas / totalRevisados,
        };
    });
}

export interface ConsultaClasificacionInput {
    fechaDesde?: string;
    fechaHasta?: string;
    operadorId?: string;
    estado?: "REVISION_MANUAL" | "CLASIFICADO" | "CORREGIDO" | "REPORTE_FALSO";
    categoria?: string;
    busqueda?: string;
    page: number;
    pageSize: number;
}

export class EstadisticasService {
    private readonly stats: EstadisticasRepository;
    private readonly reportes: ReporteRepository;
    private readonly plataformas: PlataformaRepository;
    private readonly ciudades: CiudadRepository;
    private readonly correcciones: CorreccionAdminRepository;
    private readonly audit: AuditLogRepository;
    private readonly usuarios: UsuarioRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.stats = new EstadisticasRepository(tx);
        this.reportes = new ReporteRepository(tx);
        this.plataformas = new PlataformaRepository(tx);
        this.ciudades = new CiudadRepository(tx);
        this.correcciones = new CorreccionAdminRepository(tx);
        this.audit = new AuditLogRepository(tx);
        this.usuarios = new UsuarioRepository(tx);
    }

    /** GET /api/estadisticas-publicas — agregados públicos (sin score, I-29). */
    async publicas() {
        const [
            totalReportes,
            identificadoresUnicos,
            reportesAutenticados,
            reportesAnonimos,
            porPlataforma,
            porPais,
            porCiudadConIds,
            categoriasRaw,
            sinUbicacion,
        ] = await Promise.all([
            this.reportes.countWhere(whereReporteAprobado()),
            this.stats.countIdentificadores(),
            this.reportes.countWhere(whereReporteAprobado({ esAnonimo: false })),
            this.reportes.countWhere(whereReporteAprobado({ esAnonimo: true })),
            this.stats.groupByPlataformaId(whereReporteAprobado()),
            this.stats.groupByPais(whereReporteAprobado()),
            this.stats.groupByCiudadId(whereReporteAprobado({ ciudadId: { not: null } }), 50),
            this.stats.findCategoriasAprobadas(CATEGORIAS_NO_APROBADAS, whereReporteEnEstados(ESTADOS_APROBADOS)),
            // SPEC-115 (degradación honesta del mapa): reportes aprobados que el mapa
            // NO puede pintar porque su ciudad carece de coordenadas (o no hay ciudad).
            this.reportes.countWhere(
                whereReporteAprobado({
                    OR: [{ ciudadId: null }, { ciudadRel: { lat: null } }, { ciudadRel: { lng: null } }],
                })
            ),
        ]);

        const plataformaIds = porPlataforma.map((p) => p.plataformaId).filter((id): id is string => !!id);
        const plataformasMap =
            plataformaIds.length > 0
                ? Object.fromEntries((await this.plataformas.findNombresPorIds(plataformaIds)).map((p) => [p.id, p.nombre]))
                : {};

        const ciudadIds = porCiudadConIds.map((c) => c.ciudadId).filter((id): id is string => !!id);
        const ciudadesConCoords = ciudadIds.length > 0 ? await this.ciudades.findManyConCoords(ciudadIds) : [];
        const ciudadesMap = Object.fromEntries(ciudadesConCoords.map((c) => [c.id, c]));

        const porCiudad = porCiudadConIds.map((c) => {
            const ciudad = ciudadesMap[c.ciudadId || ""];
            return {
                ciudad: ciudad?.nombre || "Desconocida",
                pais: ciudad?.pais.nombre || "Desconocido",
                count: c._count.id,
                lat: ciudad?.lat ?? null,
                lng: ciudad?.lng ?? null,
            };
        });

        const gruposCategoria = await obtenerGruposCategoria();

        const porCategoriaMap = new Map<string, number>();
        for (const c of categoriasRaw) {
            porCategoriaMap.set(c.categoria, (porCategoriaMap.get(c.categoria) || 0) + 1);
        }
        const porCategoria = Array.from(porCategoriaMap.entries())
            .map(([categoria, count]) => ({ categoria, count }))
            .sort((a, b) => b.count - a.count);

        const porGrupoCategoria = agruparCategorias(
            gruposCategoria,
            porCategoria.map((c) => ({ categoria: c.categoria, total: c.count }))
        );

        return {
            totales: {
                reportes: totalReportes,
                identificadoresUnicos,
                reportesAutenticados,
                reportesAnonimos,
                // I-29 (SPEC-108): NUNCA scorePromedio en la API pública (D-10/§1.3/§1.5).
            },
            porPlataforma: porPlataforma.map((p) => ({
                plataforma: plataformasMap[p.plataformaId || ""] || "Desconocida",
                count: p._count.id,
            })),
            porPais: porPais.map((p) => ({ pais: p.pais, count: p._count.id })),
            porCiudad,
            porCategoria,
            porGrupoCategoria,
            sinUbicacion,
        };
    }

    /** GET /api/admin/estadisticas — panel admin con precisión observada y worker. */
    async admin() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoySig = new Date(hoy);
        hoySig.setDate(hoySig.getDate() + 1);

        const treintaDiasAtras = new Date(hoy);
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

        const [
            totalReportes,
            reportesHoy,
            pendientesRevision,
            pendientesAnonimizacion,
            reportesAnonimos,
            reportesAutenticados,
            porEstado,
            porCategoria,
            porPlataforma,
            porCiudad,
            tendencia,
            workerMetrics,
            confirmacionesPorCategoria,
            correccionesPorCategoria,
        ] = await Promise.all([
            this.reportes.countWhere(whereReporteVigente()),
            this.reportes.countWhere(whereReporteVigente({ creadoEn: { gte: hoy, lt: hoySig } })),
            this.reportes.countWhere(whereReporteEnEstados(["REVISION_MANUAL", "PROCESANDO"])),
            this.reportes.countWhere(whereReporteEnEstado("REQUIERE_ANONIMIZACION")),
            this.reportes.countWhere(whereReporteVigente({ esAnonimo: true })),
            this.reportes.countWhere(whereReporteVigente({ esAnonimo: false })),
            this.stats.groupByEstado(whereReporteVigente()),
            this.stats.groupByCategoriaClasificacion(whereReporteVigente()),
            this.stats.groupByPlataformaIdContandoId(whereReporteVigente({ plataformaId: { not: "" } })),
            this.stats.groupByCiudad(whereReporteVigente({ ciudad: { not: "" } }), 10),
            this.stats.groupByCreadoEn(whereReporteVigente({ creadoEn: { gte: treintaDiasAtras } })),
            getWorkerMetrics(),
            this.correcciones.groupByCategoriaOriginal(true, whereReporteVigente()),
            this.correcciones.groupByCategoriaOriginal(false, whereReporteVigente()),
        ]);

        const plataformaIds = porPlataforma
            .map((p) => p.plataformaId)
            .filter((id): id is string => id !== null && id !== undefined);
        const plataformasMap = await this.plataformas.findNombresPorIds(plataformaIds);
        const plataformaNombrePorId = Object.fromEntries(plataformasMap.map((p) => [p.id, p.nombre]));

        const tendenciaDiaria: Record<string, number> = {};
        for (const t of tendencia) {
            const fecha = t.creadoEn.toISOString().split("T")[0];
            tendenciaDiaria[fecha] = (tendenciaDiaria[fecha] || 0) + t._count.creadoEn;
        }
        const tendenciaArray = Object.entries(tendenciaDiaria)
            .map(([fecha, count]) => ({ fecha, count }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        return {
            totales: {
                reportes: totalReportes,
                reportesHoy,
                pendientesRevision,
                pendientesAnonimizacion,
                reportesAnonimos,
                reportesAutenticados,
            },
            porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count.estado })),
            porCategoria: porCategoria.map((c) => ({ categoria: c.categoria, count: c._count.categoria })),
            porPlataforma: porPlataforma.map((p) => ({ plataforma: plataformaNombrePorId[p.plataformaId || ""] || "Desconocida", count: typeof p._count === "object" ? p._count.plataformaId : 0 })),
            porCiudad: porCiudad.map((c) => ({ ciudad: c.ciudad, count: typeof c._count === "object" ? c._count.ciudad : 0 })),
            tendencia: tendenciaArray,
            worker: workerMetrics,
            precisionPorCategoria: calcularPrecisionPorCategoria(confirmacionesPorCategoria, correccionesPorCategoria),
        };
    }

    /** GET /api/admin/estadisticas/clasificacion — tabla operativa + métricas. */
    async clasificacion(query: ConsultaClasificacionInput) {
        const { fechaDesde, fechaHasta, operadorId, estado, categoria, busqueda, page, pageSize } = query;

        const hoyInicio = startOfDay(new Date());
        const hoyFin = endOfDay(new Date());
        const rangoInicio = fechaDesde ? startOfDay(new Date(fechaDesde + "T00:00:00")) : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        const rangoFin = fechaHasta ? endOfDay(new Date(fechaHasta + "T23:59:59")) : hoyFin;
        const rango = { gte: rangoInicio, lte: rangoFin };

        // --- Indicadores tarjeta ---
        const [sinAsignar, enGestion, atendidosHoyRaw, escaladosPendientes] = await Promise.all([
            this.reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { operadorId: null })),
            this.reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { operadorId: { not: null } })),
            this.audit.countAcciones(ACCIONES_CIERRE, { gte: hoyInicio, lte: hoyFin }),
            this.reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { prioridadAlta: true })),
        ]);

        // --- Tiempo promedio de gestión ---
        const auditCerrados = await this.audit.findCierres(ACCIONES_CIERRE, rango);

        const recursoIds = auditCerrados.map((a) => a.recursoId!);
        const auditAsignaciones = await this.audit.findAsignaciones(recursoIds);

        const primeraAsignacionPorRecurso = new Map<string, Date>();
        for (const a of auditAsignaciones) {
            if (!a.recursoId) continue;
            if (!primeraAsignacionPorRecurso.has(a.recursoId)) {
                primeraAsignacionPorRecurso.set(a.recursoId, a.creadoEn);
            }
        }

        let tiempoGestionTotalMs = 0;
        let tiempoGestionCount = 0;
        for (const cierre of auditCerrados) {
            if (!cierre.recursoId) continue;
            const asignacion = primeraAsignacionPorRecurso.get(cierre.recursoId);
            if (asignacion && cierre.creadoEn > asignacion) {
                tiempoGestionTotalMs += cierre.creadoEn.getTime() - asignacion.getTime();
                tiempoGestionCount++;
            }
        }
        const tiempoPromedioGestionMin = tiempoGestionCount > 0 ? Math.round(tiempoGestionTotalMs / tiempoGestionCount / 60000) : 0;

        // --- Casos por día ---
        const casosPorDia = await this.audit.groupByAccion(ACCIONES_CIERRE, rango);
        const casosPorDiaRaw = await this.stats.casosPorDia(rangoInicio, rangoFin);

        // --- Distribución por operador ---
        const distribucionOperador = await this.audit.groupByUsuario(ACCIONES_CIERRE, rango);

        const operadoresIds = distribucionOperador.map((d) => d.usuarioId).filter(Boolean) as string[];
        const operadoresInfo = await this.usuarios.findInfoPorIds(operadoresIds);
        const operadorMap = new Map(operadoresInfo.map((o) => [o.id, o]));

        // --- Clasificaciones por categoría ---
        const clasificacionesPorCategoria = await this.stats.clasificacionesPorCategoriaCorregidas();

        // --- Tasa de escalamiento por operador ---
        const escaladosPorOperador = await this.audit.groupByUsuario(["CASO_ESCALADO"], rango);

        // --- Tabla operativa ---
        const whereTabla: Prisma.ReporteWhereInput = {};
        if (estado) whereTabla.estado = estado as never;
        if (operadorId) whereTabla.operadorId = operadorId;
        if (categoria) whereTabla.clasificacion = { categoria: categoria as never };
        if (busqueda) {
            whereTabla.OR = [
                { identificador: { contains: busqueda, mode: "insensitive" } },
                { numeroSeguimiento: { contains: busqueda, mode: "insensitive" } },
                { operador: { nombre: { contains: busqueda, mode: "insensitive" } } },
            ];
        }

        const [reportesTabla, totalTabla] = await this.reportes.findTablaClasificacion(whereTabla, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        // --- Métricas por operador ---
        const metricasOperador: Record<string, { atendidos: number; confirmados: number; corregidos: number; dadosDeBaja: number; escalados: number; tiempoPromedioMin: number }> = {};
        for (const op of operadoresIds) {
            metricasOperador[op] = { atendidos: 0, confirmados: 0, corregidos: 0, dadosDeBaja: 0, escalados: 0, tiempoPromedioMin: 0 };
        }

        const accionesPorOperador = await this.audit.findAccionesPorOperadores(
            [...ACCIONES_CIERRE, "CASO_ESCALADO"],
            operadoresIds,
            rango
        );

        for (const a of accionesPorOperador) {
            if (!a.usuarioId) continue;
            const m = metricasOperador[a.usuarioId];
            if (!m) continue;
            if (a.accion === "CASO_CONFIRMADO") m.confirmados++;
            if (a.accion === "CASO_CORREGIDO") m.corregidos++;
            if (a.accion === "CASO_DADO_DE_BAJA") m.dadosDeBaja++;
            if (a.accion === "CASO_ESCALADO") m.escalados++;
        }

        for (const op of Object.keys(metricasOperador)) {
            const m = metricasOperador[op];
            m.atendidos = m.confirmados + m.corregidos + m.dadosDeBaja;

            const asignacionesOp = await this.audit.findAsignaciones(recursoIds, op);
            const asignacionMap = new Map(asignacionesOp.map((a) => [a.recursoId!, a.creadoEn]));
            let totalMs = 0;
            let count = 0;
            for (const cierre of auditCerrados) {
                if (!cierre.recursoId) continue;
                const asignacion = asignacionMap.get(cierre.recursoId);
                if (asignacion && cierre.creadoEn > asignacion) {
                    totalMs += cierre.creadoEn.getTime() - asignacion.getTime();
                    count++;
                }
            }
            m.tiempoPromedioMin = count > 0 ? Math.round(totalMs / count / 60000) : 0;
        }

        return {
            indicadores: {
                sinAsignar,
                enGestion,
                atendidosHoy: atendidosHoyRaw,
                tiempoPromedioGestionMin,
                escaladosPendientes,
            },
            casosPorDia: casosPorDiaRaw.map((d) => ({ dia: d.dia, accion: d.accion, count: Number(d.count) })),
            resumenCasosPorDia: casosPorDia.map((d) => ({ accion: d.accion, count: d._count.accion })),
            distribucionOperador: distribucionOperador
                .filter((d) => d.usuarioId)
                .map((d) => ({
                    operadorId: d.usuarioId,
                    nombre: operadorMap.get(d.usuarioId!)?.nombre || operadorMap.get(d.usuarioId!)?.email || d.usuarioId,
                    count: d._count.usuarioId,
                })),
            clasificacionesPorCategoria: clasificacionesPorCategoria.map((c) => ({ categoria: c.categoria, count: Number(c.count) })),
            escaladosPorOperador: escaladosPorOperador
                .filter((d) => d.usuarioId)
                .map((d) => ({
                    operadorId: d.usuarioId,
                    nombre: operadorMap.get(d.usuarioId!)?.nombre || operadorMap.get(d.usuarioId!)?.email || d.usuarioId,
                    count: d._count.usuarioId,
                })),
            metricasOperador: Object.entries(metricasOperador).map(([operadorId, m]) => ({
                operadorId,
                nombre: operadorMap.get(operadorId)?.nombre || operadorMap.get(operadorId)?.email || operadorId,
                ...m,
            })),
            tabla: {
                reportes: reportesTabla,
                pagination: { page, pageSize, total: totalTabla, totalPages: Math.ceil(totalTabla / pageSize) },
            },
        };
    }
}
