/**
 * SPEC-239 (002-PI-mega-cola): repositorio DAL de ContactoEmergencia.
 * Frontera Q-3: TODO el acceso a Prisma de contactos de emergencia pasa por
 * aquí; las rutas /api/padre/contacto-emergencia y el servicio de activación
 * de emergencia no importan `@/lib/prisma`.
 *
 * Reglas duras:
 * - TODO acceso filtra por `padreUsuarioId` (anti cross-user leak, SC-001):
 *   un id ajeno simplemente no existe para el llamador (404 en la capa API).
 * - Baja lógica (`activo: false`), nunca borrado físico (D3: trazabilidad de
 *   activaciones históricas).
 */
import type { ContactoEmergencia, Prisma, RelacionContactoEmergencia } from "@prisma/client";
import { prisma } from "../prisma.ts";
import type { DbClient } from "../unit-of-work";

export interface CrearContactoEmergenciaInput {
    padreUsuarioId: string;
    nombre: string;
    relacion: RelacionContactoEmergencia;
    telefono: string;
    email?: string | undefined;
    prioridad: number;
}

export interface ActualizarContactoEmergenciaInput {
    nombre?: string | undefined;
    relacion?: RelacionContactoEmergencia | undefined;
    telefono?: string | undefined;
    email?: string | null | undefined;
    prioridad?: number | undefined;
    activo?: boolean | undefined;
}

export interface ListaContactosResult {
    items: ContactoEmergencia[];
    total: number;
}

export class ContactoEmergenciaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Contactos ACTIVOS del padre ordenados por prioridad ascendente
     * (desempate por creación): el primero es el receptor prioritario de una
     * activación de emergencia (fallback 1 → 2 → 3, D4).
     */
    findActivosPorPadre(padreUsuarioId: string): Promise<ContactoEmergencia[]> {
        const where: Prisma.ContactoEmergenciaWhereInput = { padreUsuarioId, activo: true };
        return this.db.contactoEmergencia.findMany({
            where,
            orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
        });
    }

    /** Lista paginada de contactos del padre (por defecto solo activos). */
    async listarPorPadre(
        padreUsuarioId: string,
        opciones: { soloActivos?: boolean; page?: number; pageSize?: number } = {}
    ): Promise<ListaContactosResult> {
        const { soloActivos = true, page = 1, pageSize = 25 } = opciones;
        const where: Prisma.ContactoEmergenciaWhereInput = {
            padreUsuarioId,
            ...(soloActivos ? { activo: true } : {}),
        };
        const [items, total] = await Promise.all([
            this.db.contactoEmergencia.findMany({
                where,
                orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.db.contactoEmergencia.count({ where }),
        ]);
        return { items, total };
    }

    /** Contacto por id acotado al padre (ownership); null si no existe o es ajeno. */
    findByIdAndPadre(id: string, padreUsuarioId: string): Promise<ContactoEmergencia | null> {
        return this.db.contactoEmergencia.findFirst({ where: { id, padreUsuarioId } });
    }

    crear(data: CrearContactoEmergenciaInput): Promise<ContactoEmergencia> {
        return this.db.contactoEmergencia.create({
            data: {
                padreUsuarioId: data.padreUsuarioId,
                nombre: data.nombre,
                relacion: data.relacion,
                telefono: data.telefono,
                email: data.email ?? null,
                prioridad: data.prioridad,
            },
        });
    }

    actualizar(id: string, data: ActualizarContactoEmergenciaInput): Promise<ContactoEmergencia> {
        const update: Prisma.ContactoEmergenciaUpdateInput = {};
        if (data.nombre !== undefined) update.nombre = data.nombre;
        if (data.relacion !== undefined) update.relacion = data.relacion;
        if (data.telefono !== undefined) update.telefono = data.telefono;
        if (data.email !== undefined) update.email = data.email;
        if (data.prioridad !== undefined) update.prioridad = data.prioridad;
        if (data.activo !== undefined) update.activo = data.activo;
        return this.db.contactoEmergencia.update({ where: { id }, data: update });
    }

    /** Baja lógica (D3): conserva la fila para trazabilidad. */
    desactivar(id: string): Promise<ContactoEmergencia> {
        return this.db.contactoEmergencia.update({ where: { id }, data: { activo: false } });
    }
}
