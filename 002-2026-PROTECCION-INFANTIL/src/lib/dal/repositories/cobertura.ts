/**
 * SPEC-169 (Fase G): cálculo de cobertura de identificadores por tipo de sujeto.
 * Cobertura = % de sujetos activos con al menos un identificador activo.
 * Todo se acota por `colegioId` (tenant-first E-1 / SPEC-134).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface CoberturaSujeto {
    total: number;
    conIdentificador: number;
    porcentaje: number;
}

export interface CoberturaColegio {
    estudiantes: CoberturaSujeto;
    profesores: CoberturaSujeto;
    acudientes: CoberturaSujeto;
    /** Verdadero si al menos un sujeto activo tiene al menos un identificador activo. */
    tieneCoberturaGlobal: boolean;
}

export class CoberturaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    async calcular(colegioId: string): Promise<CoberturaColegio> {
        const [
            totalEstudiantes,
            conIdentificadorEstudiante,
            totalProfesores,
            conIdentificadorProfesor,
            totalAcudientes,
            conIdentificadorAcudiente,
        ] = await Promise.all([
            this.db.estudiante.count({
                where: { colegioId, estado: "activo" },
            }),
            this.db.estudiante.count({
                where: {
                    colegioId,
                    estado: "activo",
                    identificadores: { some: { estado: "activo" } },
                },
            }),
            this.db.profesor.count({
                where: { colegioId, estado: "activo" },
            }),
            this.db.profesor.count({
                where: {
                    colegioId,
                    estado: "activo",
                    identificadoresProf: { some: { estado: "activo" } },
                },
            }),
            this.db.acudienteEstudiante.count({
                where: {
                    estado: "activo",
                    estudiante: { colegioId, estado: "activo" },
                },
            }),
            this.db.acudienteEstudiante.count({
                where: {
                    estado: "activo",
                    estudiante: { colegioId, estado: "activo" },
                    identificadores: { some: { estado: "activo" } },
                },
            }),
        ]);

        return {
            estudiantes: {
                total: totalEstudiantes,
                conIdentificador: conIdentificadorEstudiante,
                porcentaje: totalEstudiantes > 0 ? conIdentificadorEstudiante / totalEstudiantes : 0,
            },
            profesores: {
                total: totalProfesores,
                conIdentificador: conIdentificadorProfesor,
                porcentaje: totalProfesores > 0 ? conIdentificadorProfesor / totalProfesores : 0,
            },
            acudientes: {
                total: totalAcudientes,
                conIdentificador: conIdentificadorAcudiente,
                porcentaje: totalAcudientes > 0 ? conIdentificadorAcudiente / totalAcudientes : 0,
            },
            tieneCoberturaGlobal:
                conIdentificadorEstudiante > 0 ||
                conIdentificadorProfesor > 0 ||
                conIdentificadorAcudiente > 0,
        };
    }
}
