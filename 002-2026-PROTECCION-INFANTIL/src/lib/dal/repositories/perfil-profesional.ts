/**
 * SPEC-391 (A-75 · L1b) · Repositorio del PerfilProfesional.
 *
 * Q-3 / E-8: el acceso a Prisma vive acá; los routes solo llaman al servicio o
 * al repo. La ruta PUT del perfil merge quirúrgico + la ruta de autorización
 * comparten los mismos dos métodos: `findConCiudadPorUsuarioId` para leer y
 * `crearBorrador` / `actualizarParcial` / `marcarEnRevision` para escribir.
 */
import type { EstadoPerfilProfesional, PerfilProfesional, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CIUDAD = { ciudad: { select: { id: true, nombre: true } } } as const;
export type PerfilConCiudad = PerfilProfesional & { ciudad: { id: string; nombre: string } };

export class PerfilProfesionalRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findConCiudadPorUsuarioId(usuarioId: string): Promise<PerfilConCiudad | null> {
        return this.db.perfilProfesional.findUnique({
            where: { usuarioId },
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad | null>;
    }

    findPorUsuarioId(usuarioId: string): Promise<PerfilProfesional | null> {
        return this.db.perfilProfesional.findUnique({ where: { usuarioId } });
    }

    crearBorrador(data: Prisma.PerfilProfesionalCreateInput): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.create({
            data,
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }

    actualizarParcial(id: string, data: Prisma.PerfilProfesionalUpdateInput): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.update({
            where: { id },
            data,
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }

    /** Cambia el estado sin tocar nada más (transición BORRADOR→EN_REVISION). */
    cambiarEstado(id: string, estado: EstadoPerfilProfesional): Promise<PerfilConCiudad> {
        return this.db.perfilProfesional.update({
            where: { id },
            data: { estado },
            include: INCLUDE_CIUDAD,
        }) as Promise<PerfilConCiudad>;
    }
}
