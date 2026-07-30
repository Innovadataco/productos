/**
 * SPEC-053 (US3, módulo Estadísticas, D3): EstadisticasRepository — adaptador
 * de agregaciones. Las raw queries ($queryRaw) viven AQUÍ, nunca en rutas ni
 * en servicios genéricos. Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class EstadisticasRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    countIdentificadores() {
        return this.db.identificadorReportado.count();
    }

    groupByPlataformaId(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({ by: ["plataformaId"], _count: { id: true }, where });
    }

    groupByPlataformaIdContandoId(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({ by: ["plataformaId"], _count: { plataformaId: true }, where });
    }

    groupByPais(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({
            by: ["pais"],
            _count: { id: true },
            where,
            orderBy: { _count: { id: "desc" } },
        });
    }

    groupByCiudadId(where: Prisma.ReporteWhereInput, take: number) {
        return this.db.reporte.groupBy({
            by: ["ciudadId"],
            _count: { id: true },
            where,
            orderBy: { _count: { id: "desc" } },
            take,
        });
    }

    groupByCiudad(where: Prisma.ReporteWhereInput, take: number) {
        return this.db.reporte.groupBy({
            by: ["ciudad"],
            _count: { ciudad: true },
            where,
            take,
            orderBy: { _count: { ciudad: "desc" } },
        });
    }

    groupByEstado(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({ by: ["estado"], _count: { estado: true }, where });
    }

    groupByCreadoEn(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({
            by: ["creadoEn"],
            _count: { creadoEn: true },
            where,
            orderBy: { creadoEn: "asc" },
        });
    }

    /** Categorías aprobadas de clasificaciones cuyo reporte cumple el predicado. */
    findCategoriasAprobadas(categoriasNoAprobadas: readonly string[], whereReporte: Prisma.ReporteWhereInput) {
        return this.db.clasificacionIA.findMany({
            where: {
                categoria: { notIn: [...categoriasNoAprobadas] as Prisma.EnumCategoriaConductaFilter["notIn"] },
                reporte: whereReporte,
            },
            select: { categoria: true },
        });
    }

    groupByCategoriaClasificacion(whereReporte: Prisma.ReporteWhereInput) {
        return this.db.clasificacionIA.groupBy({
            by: ["categoria"],
            _count: { categoria: true },
            where: { reporte: whereReporte },
        });
    }

    /** RAW (D3): casos por día y acción en el rango (DATE de Postgres). */
    casosPorDia(rangoInicio: Date, rangoFin: Date) {
        return this.db.$queryRaw<Array<{ dia: string; accion: string; count: bigint }>>`
            SELECT DATE("creadoEn") as dia, accion, COUNT(*) as count
            FROM "AuditLog"
            WHERE accion IN ('CASO_CONFIRMADO','CASO_CORREGIDO','CASO_DADO_DE_BAJA')
              AND "creadoEn" >= ${rangoInicio}
              AND "creadoEn" <= ${rangoFin}
            GROUP BY dia, accion
            ORDER BY dia ASC
        `;
    }

    /** RAW (D3): clasificaciones por categoría de reportes con corrección admin. */
    clasificacionesPorCategoriaCorregidas() {
        return this.db.$queryRaw<Array<{ categoria: string; count: bigint }>>`
            SELECT categoria, COUNT(*) as count
            FROM "ClasificacionIA"
            WHERE "reporteId" IN (
                SELECT "reporteId" FROM "CorreccionAdmin"
            )
            GROUP BY categoria
            ORDER BY count DESC
        `;
    }
}
