/**
 * SPEC-395 (L4) · Repositorio de FranjaDisponible.
 * Q-3: acceso a Prisma acá; el service la usa. La franja se marca `tomada = true`
 * cuando el padre solicita la cita, y se libera si la solicitud expira sin pago
 * o si el profesional rechaza.
 */
import type { FranjaDisponible, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class FranjaDisponibleRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.FranjaDisponibleCreateInput) {
        return this.db.franjaDisponible.create({ data });
    }

    findById(id: string): Promise<FranjaDisponible | null> {
        return this.db.franjaDisponible.findUnique({ where: { id } });
    }

    listarLibresDeProfesional(profesionalId: string, desde: Date) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, tomada: false, inicio: { gte: desde } },
            orderBy: { inicio: "asc" },
            take: 60,
        });
    }

    listarDeProfesional(profesionalId: string) {
        return this.db.franjaDisponible.findMany({
            where: { profesionalId, inicio: { gte: new Date() } },
            orderBy: { inicio: "asc" },
            take: 200,
        });
    }

    /**
     * SPEC-447 (I-311): ¿hay ya una franja del profesional que se pise con
     * `[inicio, fin)`? Dos franjas se solapan cuando cada una empieza antes de
     * que termine la otra. Se comparan en UTC —que es como se guardan— así que
     * no hay zona horaria de por medio.
     *
     * Incluye las TOMADAS a propósito: una franja reservada ocupa la agenda
     * igual que una libre, y publicar encima sería prometer dos citas a la vez.
     */
    existeSolapada(profesionalId: string, inicio: Date, fin: Date, excluirId?: string) {
        return this.db.franjaDisponible.findFirst({
            where: {
                profesionalId,
                ...(excluirId ? { id: { not: excluirId } } : {}),
                inicio: { lt: fin },
                fin: { gt: inicio },
            },
            select: { id: true, inicio: true, fin: true },
        });
    }

    marcarTomadaSiLibre(id: string) {
        return this.db.franjaDisponible.updateMany({
            where: { id, tomada: false },
            data: { tomada: true },
        });
    }

    liberar(id: string) {
        return this.db.franjaDisponible.update({ where: { id }, data: { tomada: false } });
    }

    borrarSiLibre(id: string) {
        return this.db.franjaDisponible.deleteMany({ where: { id, tomada: false } });
    }
}
