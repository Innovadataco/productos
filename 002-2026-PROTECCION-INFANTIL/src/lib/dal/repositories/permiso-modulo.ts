/**
 * E-8 (002-PI-056): repositorio de ModuloPermisible + PermisoModulo (matriz de
 * permisos por rol). Dominio global (sin tenant). Acepta tx opcional (D2).
 */
import type { Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withUnitOfWork, type DbClient } from "../unit-of-work";

export interface CambioPermisoModulo {
    rol: string;
    moduloId: string;
    activo: boolean;
}

export class PermisoModuloRepository {
    private readonly db: DbClient;
    private readonly tx: Prisma.TransactionClient | undefined;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
        this.tx = tx;
    }

    /** Árbol de módulos: raíces con submódulos ordenados (matriz del admin). */
    listarArbolModulos() {
        return this.db.moduloPermisible.findMany({
            where: { padreId: null },
            include: { submodulos: { orderBy: { orden: "asc" } } },
            orderBy: { orden: "asc" },
        });
    }

    /** Todos los permisos actuales (rol × módulo × activo). */
    listarTodos() {
        return this.db.permisoModulo.findMany({
            select: { rol: true, moduloId: true, activo: true },
        });
    }

    /** Módulos por ids (validación de existencia antes de aplicar cambios). */
    listarModulosPorIds(ids: string[]) {
        return this.db.moduloPermisible.findMany({ where: { id: { in: ids } } });
    }

    /** Módulos críticos (guarda anti-lockout). */
    listarCriticos() {
        return this.db.moduloPermisible.findMany({ where: { esCritico: true } });
    }

    /** Permisos de los roles protegidos sobre módulos críticos (estado actual). */
    listarPermisosPorRolesYModulos(roles: string[], moduloIds: string[]) {
        // SPEC-509: la columna es enum; los roles llegan como string (params/JWT).
        return this.db.permisoModulo.findMany({
            where: { rol: { in: roles as RolUsuario[] }, moduloId: { in: moduloIds } },
        });
    }

    /** Snapshot previo de los permisos que cambian (auditoría). */
    snapshotDe(cambios: CambioPermisoModulo[]) {
        return this.db.permisoModulo.findMany({
            where: { OR: cambios.map((c) => ({ rol: c.rol as RolUsuario, moduloId: c.moduloId })) },
            select: { rol: true, moduloId: true, activo: true },
        });
    }

    /** Aplica los cambios en UNA transacción (upsert por rol+módulo). */
    aplicarCambios(cambios: CambioPermisoModulo[], actualizadoPorId: string) {
        return withUnitOfWork(async (tx) => {
            const resultados = [];
            for (const c of cambios) {
                resultados.push(
                    await tx.permisoModulo.upsert({
                        where: { rol_moduloId: { rol: c.rol as RolUsuario, moduloId: c.moduloId } },
                        update: { activo: c.activo, actualizadoPorId },
                        create: { rol: c.rol as RolUsuario, moduloId: c.moduloId, activo: c.activo, actualizadoPorId },
                    })
                );
            }
            return resultados;
        }, this.tx);
    }
}
