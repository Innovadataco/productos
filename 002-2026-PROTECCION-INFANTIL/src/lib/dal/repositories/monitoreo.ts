/**
 * SPEC-171 (Pilar B): repositorio de monitoreo de infraestructura.
 * Centraliza las queries de HealthProbe, IncidenteInfra y el conteo de
 * reportes atascados para que los endpoints /api/admin/monitoreo/* deleguen
 * (frontera DAL Q-3: las rutas no importan prisma).
 */
import type { EstadoReporte, HealthProbe, IncidenteInfra, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class MonitoreoRepository {
    constructor(private readonly db: DbClient = prisma) {}

    /** Ping trivial a la BD (probe del vigilante). Lanza si la BD no responde. */
    async pingBd(): Promise<void> {
        await this.db.$queryRaw`SELECT 1`;
    }

    /** Persiste el resultado de un probe (append-only). */
    async crearProbe(data: {
        senal: string;
        ok: boolean;
        latenciaMs: number;
        detalle: string | null;
        metodo?: string | null;
    }): Promise<void> {
        await this.db.healthProbe.create({ data });
    }

    /** Incidente ABIERTO de una señal, si existe. */
    async incidenteAbiertoDe(senal: string): Promise<IncidenteInfra | null> {
        return this.db.incidenteInfra.findFirst({ where: { senal, estado: "ABIERTO" } });
    }

    /** Abre un incidente para la señal. */
    async crearIncidente(senal: string, detalle: string | null): Promise<IncidenteInfra> {
        return this.db.incidenteInfra.create({ data: { senal, estado: "ABIERTO", detalle } });
    }

    /** Cierra un incidente (estado RESUELTO con su `fin`). */
    async resolverIncidente(id: string, fin: Date): Promise<void> {
        await this.db.incidenteInfra.update({ where: { id }, data: { estado: "RESUELTO", fin } });
    }

    /** Marca la hora del último email enviado (throttle). */
    async marcarEmailEnviado(id: string, fecha: Date): Promise<void> {
        await this.db.incidenteInfra.update({ where: { id }, data: { ultimoEmailEn: fecha } });
    }

    /** Señales con un incidente ABIERTO ahora mismo. */
    async senalesConIncidentesAbiertos(): Promise<string[]> {
        const abiertos = await this.db.incidenteInfra.findMany({
            where: { estado: "ABIERTO" },
            select: { senal: true },
        });
        return abiertos.map((i) => i.senal);
    }

    /** Último HealthProbe por señal (en el orden del arreglo recibido). */
    async ultimosProbesPorSenal(senales: readonly string[]): Promise<Array<HealthProbe | null>> {
        return Promise.all(
            senales.map((senal) => this.db.healthProbe.findFirst({ where: { senal }, orderBy: { creadoEn: "desc" } }))
        );
    }

    /** Historial paginado de incidentes, más recientes primero. */
    async incidentesPaginados(
        where: Prisma.IncidenteInfraWhereInput,
        page: number,
        pageSize: number
    ): Promise<{ items: IncidenteInfra[]; total: number }> {
        const [items, total] = await Promise.all([
            this.db.incidenteInfra.findMany({
                where,
                orderBy: { inicio: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.db.incidenteInfra.count({ where }),
        ]);
        return { items, total };
    }

    /**
     * Conteos por estado de reportes "atascados": llevan más de N horas en un
     * estado que exige movimiento (cola o revisión). Solo agregados.
     */
    async conteoAtascados(
        corte: Date,
        estados: readonly EstadoReporte[]
    ): Promise<{ porEstado: Partial<Record<EstadoReporte, number>>; total: number }> {
        const grupos = await this.db.reporte.groupBy({
            by: ["estado"],
            where: { estado: { in: [...estados] }, creadoEn: { lt: corte } },
            _count: { _all: true },
        });
        const porEstado: Partial<Record<EstadoReporte, number>> = {};
        let total = 0;
        for (const grupo of grupos) {
            porEstado[grupo.estado] = grupo._count._all;
            total += grupo._count._all;
        }
        return { porEstado, total };
    }

    /**
     * SPEC-186 (002-PI-081): último probe de una señal filtrado por método.
     * Usado para decidir si toca smoke real (último SMOKE exitoso).
     */
    async ultimoProbePorSenalYMetodo(
        senal: string,
        metodo: string,
        ok?: boolean
    ): Promise<HealthProbe | null> {
        const where: Prisma.HealthProbeWhereInput = { senal, metodo };
        if (ok !== undefined) where.ok = ok;
        return this.db.healthProbe.findFirst({ where, orderBy: { creadoEn: "desc" } });
    }

    /** SPEC-186: historial de probes de una señal, más recientes primero. */
    async historialProbes(senal: string, limite: number): Promise<HealthProbe[]> {
        return this.db.healthProbe.findMany({
            where: { senal },
            orderBy: { creadoEn: "desc" },
            take: limite,
        });
    }

    /**
     * SPEC-186: resumen de Ollama en las últimas 24h para el tablero.
     * Cuenta pings, piggybacks, smokes reales y fallos de ambas señales Ollama.
     */
    async resumenOllamaUltimas24h(): Promise<{ pings: number; piggybacks: number; smokes: number; fallos: number }> {
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const probes = await this.db.healthProbe.findMany({
            where: {
                senal: { in: ["ollama_ping", "ollama_smoke"] },
                creadoEn: { gte: desde },
            },
            select: { senal: true, ok: true, metodo: true },
        });
        let pings = 0;
        let piggybacks = 0;
        let smokes = 0;
        let fallos = 0;
        for (const p of probes) {
            if (!p.ok) {
                fallos++;
                continue;
            }
            if (p.senal === "ollama_ping") {
                pings++;
            } else if (p.metodo === "PIGGYBACK") {
                piggybacks++;
            } else {
                smokes++;
            }
        }
        return { pings, piggybacks, smokes, fallos };
    }
}
