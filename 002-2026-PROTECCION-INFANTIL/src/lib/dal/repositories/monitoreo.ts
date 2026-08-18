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
    async crearProbe(data: { senal: string; ok: boolean; latenciaMs: number; detalle: string | null }): Promise<void> {
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
}
