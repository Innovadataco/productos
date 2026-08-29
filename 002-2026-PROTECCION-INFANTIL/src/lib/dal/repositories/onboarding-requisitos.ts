/**
 * SPEC-169 (Fase G): conteos de requisitos para el onboarding del colegio.
 * Mantiene la regla Q-3: el servicio no accede directamente a Prisma.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface RequisitosOnboarding {
    cursos: number;
    estudiantes: number;
    profesores: number;
    acudientes: number;
}

export class OnboardingRequisitosRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    async contar(colegioId: string): Promise<RequisitosOnboarding> {
        const [cursos, estudiantes, profesores, acudientes] = await Promise.all([
            this.db.curso.count({ where: { colegioId, estado: "activo" } }),
            this.db.estudiante.count({ where: { colegioId, estado: "activo" } }),
            this.db.profesor.count({ where: { colegioId, estado: "activo" } }),
            this.db.acudienteEstudiante.count({
                where: {
                    estado: "activo",
                    estudiante: { colegioId, estado: "activo" },
                },
            }),
        ]);

        return { cursos, estudiantes, profesores, acudientes };
    }
}
