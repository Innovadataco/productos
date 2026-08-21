/**
 * SPEC-194 (002-PI-088): helpers tipados para construir filtros de usuarios
 * en el admin (sub-tab Padres y futuros roles). No toca BD; solo arma el where.
 */

import type { Prisma } from "@prisma/client";

export interface FiltrosUsuarios {
    rol: "PARENT" | "SCHOOL_ADMIN" | "OPERADOR" | "COMITE_VALIDACION" | "ADMIN";
    q?: string | undefined;
    estado?: "activo" | "inactivo" | "bloqueado" | undefined;
    desde?: string | undefined;
    hasta?: string | undefined;
    conReportes?: boolean | undefined;
    colegioId?: string | undefined;
}

export function construirWhereUsuarios(filtros: FiltrosUsuarios): Prisma.UsuarioWhereInput {
    const where: Prisma.UsuarioWhereInput = { rol: filtros.rol };

    if (filtros.q) {
        where.OR = [
            { email: { contains: filtros.q, mode: "insensitive" } },
            { nombre: { contains: filtros.q, mode: "insensitive" } },
        ];
    }

    if (filtros.estado) {
        where.estado = filtros.estado;
    }

    if (filtros.desde || filtros.hasta) {
        where.creadoEn = {};
        if (filtros.desde) {
            where.creadoEn.gte = new Date(`${filtros.desde}T00:00:00.000Z`);
        }
        if (filtros.hasta) {
            where.creadoEn.lte = new Date(`${filtros.hasta}T23:59:59.999Z`);
        }
    }

    if (filtros.colegioId) {
        where.AND = [
            ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
            { OR: [{ colegioId: filtros.colegioId }, { tenantId: filtros.colegioId }] },
        ];
    }

    if (filtros.conReportes === true) {
        where.reportes = { some: { eliminado: false } };
    } else if (filtros.conReportes === false) {
        where.reportes = { none: { eliminado: false } };
    }

    return where;
}
