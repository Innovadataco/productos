/**
 * SPEC-169 (Fase G): repositorio de OnboardingColegio — fila única por colegio.
 * Todo acceso exige `colegioId` (tenant-first E-1 / SPEC-134).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";

export type EstadoOnboarding = "activo" | "omitido" | "completado";

export class OnboardingColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    obtenerPorColegio(colegioId: string) {
        return this.db.onboardingColegio.findUnique({
            where: { colegioId },
        });
    }

    crear(data: { colegioId: string; estado?: EstadoOnboarding; pasoActual?: number }, tx?: Prisma.TransactionClient) {
        const db = tx ?? this.db;
        return db.onboardingColegio.create({
            data: {
                colegioId: data.colegioId,
                estado: data.estado ?? "activo",
                pasoActual: data.pasoActual ?? 1,
            },
        });
    }

    async actualizarEstado(
        colegioId: string,
        estado: EstadoOnboarding,
        extras?: { pasoActual?: number; completadoEn?: Date | null }
    ) {
        const { count } = await this.db.onboardingColegio.updateMany({
            where: { colegioId },
            data: {
                estado,
                ...(extras?.pasoActual !== undefined ? { pasoActual: extras.pasoActual } : {}),
                ...(extras?.completadoEn !== undefined ? { completadoEn: extras.completadoEn } : {}),
            },
        });
        if (count === 0) {
            throw new AppError("Onboarding no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        return this.db.onboardingColegio.findUnique({ where: { colegioId } });
    }
}
