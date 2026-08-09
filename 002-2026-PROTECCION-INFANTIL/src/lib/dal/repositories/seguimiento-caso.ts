/**
 * SPEC-159 (FR-001/FR-004): repositorio de SeguimientoCaso + NotaSeguimiento —
 * la bitácora del caso del colegio. Tenant obligatorio por construcción (toda
 * firma exige `colegioId`; NotaSeguimiento lo lleva denormalizado). El
 * seguimiento es 1:1 con la alerta (`alertaId` único) y nace LAZY con la
 * primera nota: `obtenerOCrearPorAlerta` resuelve la carrera por la constraint
 * (P2002 → relectura, nunca duplicado ni error). Las notas son INMUTABLES: el
 * repo NO expone update ni delete (respaldo forense, Ley 1581).
 * Acepta un cliente transaccional opcional (D2).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CON_NOTAS = {
    notas: {
        orderBy: { creadoEn: "asc" },
        include: {
            autor: { select: { nombre: true, email: true } },
        },
    },
} satisfies Prisma.SeguimientoCasoInclude;

export type SeguimientoCasoConNotasRow = Prisma.SeguimientoCasoGetPayload<{ include: typeof INCLUDE_CON_NOTAS }>;

export class SeguimientoCasoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Seguimiento de la alerta con sus notas (asc, autor legible). Null si aún no nace. */
    obtenerPorAlerta(colegioId: string, alertaId: string): Promise<SeguimientoCasoConNotasRow | null> {
        return this.db.seguimientoCaso.findFirst({
            where: { colegioId, alertaId },
            include: INCLUDE_CON_NOTAS,
        });
    }

    /**
     * Devuelve el seguimiento 1:1 de la alerta, creándolo si no existe. La
     * carrera entre dos POST simultáneos la resuelve la constraint única de
     * `alertaId` (P2002 → relectura, patrón registrarSiAusente de SPEC-149).
     */
    async obtenerOCrearPorAlerta(colegioId: string, alertaId: string): Promise<{ id: string; estado: string }> {
        const existente = await this.db.seguimientoCaso.findFirst({
            where: { colegioId, alertaId },
            select: { id: true, estado: true },
        });
        if (existente) return existente;
        try {
            return await this.db.seguimientoCaso.create({
                data: { colegioId, alertaId },
                select: { id: true, estado: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const creado = await this.db.seguimientoCaso.findUnique({
                    where: { alertaId },
                    select: { id: true, estado: true },
                });
                if (creado && creado.id) return creado;
            }
            throw error;
        }
    }

    /** Agrega una nota a la bitácora (inmutable: no hay update/delete por diseño). */
    agregarNota(datos: { seguimientoId: string; colegioId: string; texto: string; autorId: string }) {
        return this.db.notaSeguimiento.create({
            data: datos,
            select: { id: true, texto: true, creadoEn: true, autorId: true },
        });
    }
}
