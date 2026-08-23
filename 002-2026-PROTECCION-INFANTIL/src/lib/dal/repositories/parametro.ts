/**
 * SPEC-053 (data-model §1.3): repositorio de ParametroSistema.
 * `src/lib/parametros.ts` se conserva como servicio de lectura/caché; este
 * repositorio cubre las lecturas directas que las rutas hacían con prisma.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.ts";
import type { DbClient } from "../unit-of-work.ts";

export class ParametroRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByClave(clave: string) {
        return this.db.parametroSistema.findUnique({ where: { clave } });
    }

    /** E-8: varios parámetros por clave (snapshot de configuración del motor). */
    findPorClaves(claves: string[]) {
        return this.db.parametroSistema.findMany({
            where: { clave: { in: claves } },
        });
    }

    /** SPEC-202 (002-PI-099): parámetros cuya clave comienza con un prefijo. */
    findPorPrefijo(prefijo: string) {
        return this.db.parametroSistema.findMany({
            where: { clave: { startsWith: prefijo } },
            orderBy: { clave: "asc" },
        });
    }

    /** Listado admin paginado (filtro opcional por categoría), ordenado por categoría. */
    findPaginadosConTotal(
        where: Prisma.ParametroSistemaWhereInput,
        paginacion: { skip: number; take: number }
    ) {
        return Promise.all([
            this.db.parametroSistema.findMany({
                where,
                skip: paginacion.skip,
                take: paginacion.take,
                orderBy: { categoria: "asc" },
            }),
            this.db.parametroSistema.count({ where }),
        ]);
    }

    /** Parámetros públicos no secretos (endpoint público de configuración). */
    findPublicos() {
        return this.db.parametroSistema.findMany({
            where: { esPublico: true, esSecreto: false },
        });
    }

    /** Detalle con historial de cambios (últimos 10 PARAM_UPDATE con email del autor). */
    findByClaveConHistorial(clave: string) {
        return this.db.parametroSistema.findUnique({
            where: { clave },
            include: {
                auditLogs: {
                    where: { accion: "PARAM_UPDATE" },
                    orderBy: { creadoEn: "desc" },
                    take: 10,
                    include: { usuario: { select: { email: true } } },
                },
            },
        });
    }

    crear(data: Prisma.ParametroSistemaUncheckedCreateInput) {
        return this.db.parametroSistema.create({ data });
    }

    actualizar(clave: string, data: Prisma.ParametroSistemaUncheckedUpdateInput) {
        return this.db.parametroSistema.update({ where: { clave }, data });
    }

    eliminar(clave: string) {
        return this.db.parametroSistema.delete({ where: { clave } });
    }

    upsert(
        clave: string,
        create: Prisma.ParametroSistemaUncheckedCreateInput,
        update: Prisma.ParametroSistemaUncheckedUpdateInput
    ) {
        return this.db.parametroSistema.upsert({ where: { clave }, create, update });
    }
}
