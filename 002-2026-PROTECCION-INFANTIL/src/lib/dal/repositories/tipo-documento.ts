/**
 * SPEC-320 (§2.3): repositorio del catálogo único de tipos de documento.
 * Fuente de verdad del vocabulario que consumen estudiante, profesor y comité.
 * Mismo patrón que PlataformaRepository. Acepta cliente transaccional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

export class TipoDocumentoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Catálogo completo (admin). */
    listar() {
        return this.db.tipoDocumento.findMany({ orderBy: { nombre: "asc" } });
    }

    /** Tipos activos (para poblar formularios de los tres sujetos). */
    listarActivos() {
        return this.db.tipoDocumento.findMany({
            where: { esActiva: true },
            orderBy: { nombre: "asc" },
            select: { clave: true, nombre: true, categoria: true },
        });
    }

    findByClave(clave: string) {
        return this.db.tipoDocumento.findUnique({ where: { clave } });
    }

    /** true si la clave existe y está activa (validación de alta de los sujetos). */
    async claveActiva(clave: string): Promise<boolean> {
        const t = await this.db.tipoDocumento.findUnique({ where: { clave }, select: { esActiva: true } });
        return t?.esActiva === true;
    }

    async crear(datos: { clave: string; nombre: string; categoria?: string }) {
        const existente = await this.db.tipoDocumento.findUnique({ where: { clave: datos.clave } });
        if (existente) {
            throw new AppError("Ya existe un tipo de documento con esa clave", ERROR_CODES.CONFLICT, 409);
        }
        return this.db.tipoDocumento.create({
            data: { clave: datos.clave, nombre: datos.nombre, categoria: datos.categoria ?? "persona" },
        });
    }

    async actualizar(id: string, datos: { nombre?: string; categoria?: string; esActiva?: boolean }) {
        const { count } = await this.db.tipoDocumento.updateMany({
            where: { id },
            data: {
                ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
                ...(datos.categoria !== undefined ? { categoria: datos.categoria } : {}),
                ...(datos.esActiva !== undefined ? { esActiva: datos.esActiva } : {}),
            },
        });
        if (count === 0) {
            throw new AppError("Tipo de documento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.tipoDocumento.findUniqueOrThrow({ where: { id } });
    }
}
