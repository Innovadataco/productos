/**
 * SPEC-053 (US3, módulo Estadísticas): repositorio de CorreccionAdmin.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class CorreccionAdminRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Correcciones/confirmaciones agrupadas por categoría original. */
    groupByCategoriaOriginal(confirmada: boolean, whereReporte: Prisma.ReporteWhereInput) {
        return this.db.correccionAdmin.groupBy({
            by: ["categoriaOriginal"],
            _count: { categoriaOriginal: true },
            where: { confirmada, clasificacion: { reporte: whereReporte } },
        });
    }

    /** Corrección existente de una clasificación (guarda "ya fue corregido" del comité). */
    findByClasificacionId(clasificacionId: string) {
        return this.db.correccionAdmin.findUnique({ where: { clasificacionId } });
    }

    crear(data: Prisma.CorreccionAdminUncheckedCreateInput) {
        return this.db.correccionAdmin.create({ data });
    }
}
