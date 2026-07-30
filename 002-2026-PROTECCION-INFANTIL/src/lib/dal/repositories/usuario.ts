/**
 * SPEC-053 (data-model §1.4): repositorio de Usuario.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class UsuarioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByEmail(email: string) {
        return this.db.usuario.findUnique({ where: { email } });
    }

    findById(id: string) {
        return this.db.usuario.findUnique({ where: { id } });
    }

    crear(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({ data });
    }

    actualizar(id: string, data: Prisma.UsuarioUncheckedUpdateInput) {
        return this.db.usuario.update({ where: { id }, data });
    }

    /** Operadores/comité con su perfil (filtro tenant opcional). */
    findOperadores(where: Prisma.UsuarioWhereInput) {
        return this.db.usuario.findMany({
            where,
            include: { perfilOperador: true },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** Un operador o miembro del comité por id, con su perfil. */
    findOperadorById(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: { in: ["OPERADOR", "COMITE_VALIDACION"] } },
            include: { perfilOperador: true },
        });
    }

    /** Alta de operador/comité con perfil anidado. */
    crearConPerfil(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({ data, include: { perfilOperador: true } });
    }

    /** Recarga con perfil (respuesta de PATCH). */
    findByIdConPerfil(id: string) {
        return this.db.usuario.findUnique({ where: { id }, include: { perfilOperador: true } });
    }

    /** Operadores activos para el panel de asignación (cupo y revisión de apelaciones). */
    findOperadoresActivosAsignacion() {
        return this.db.usuario.findMany({
            where: { rol: "OPERADOR", estado: "activo" },
            include: { perfilOperador: { select: { cupoMaximo: true, esRevisorDeApelaciones: true } } },
            orderBy: { creadoEn: "asc" },
        });
    }

    /** Email/nombre por ids (leyenda de métricas por operador). */
    findInfoPorIds(ids: string[]) {
        return this.db.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, email: true, nombre: true },
        });
    }
}
