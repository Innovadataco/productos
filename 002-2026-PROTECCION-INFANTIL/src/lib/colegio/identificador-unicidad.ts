/**
 * SPEC-320 (§2.1): unicidad del identificador cruzando los tres sujetos dentro
 * del colegio. Dado (colegioId, valor normalizado), devuelve las OTRAS personas
 * del colegio (estudiante / profesor / acudiente) que ya tienen ese identificador
 * ACTIVO. Vacío = libre.
 *
 * Es la mitad de aplicación de la opción A (warn-con-override): la BD protege el
 * duplicado exacto por-tabla (índices únicos parciales NULLS NOT DISTINCT); este
 * servicio detecta el cruce ENTRE sujetos —incluido el que la BD deja pasar a
 * propósito (padre-de-dos-hijos en acudiente)— para que el rector decida. NUNCA
 * bloquea: el caller responde con un aviso, no con un error.
 *
 * Un solo lugar (candado 22 v5): los 8 callsites de identificador lo consumen.
 * Distinto de `buscarActivosPorValor` de los repos (cross-TENANT, alimenta el
 * motor de alertas) — este es cross-SUJETO dentro de UN colegio.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/dal/unit-of-work";

export type SujetoIdentificador = "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE";

export interface DuenoIdentificador {
    sujeto: SujetoIdentificador;
    sujetoId: string;
    nombre: string;
    rol: string;
}

/** Sujeto a excluir de la búsqueda (la persona/registro que se está editando). */
export interface ExcluirSujeto {
    sujeto: SujetoIdentificador;
    sujetoId: string;
}

export class IdentificadorUnicidadService {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Otras personas del colegio con ese identificador activo. `valor` debe venir
     * ya normalizado (mismo criterio que se guarda). `excluir` omite al propio
     * sujeto (para no auto-reportarse al editar).
     */
    async buscarOtrosDuenos(
        colegioId: string,
        valor: string,
        excluir?: ExcluirSujeto
    ): Promise<DuenoIdentificador[]> {
        const [estudiantes, profesores, acudientes] = await Promise.all([
            this.db.identificadorEstudiante.findMany({
                where: { colegioId, valor, estado: "activo" },
                select: { estudianteId: true, estudiante: { select: { nombre: true, apellidos: true } } },
            }),
            this.db.identificadorProfesor.findMany({
                where: { colegioId, valor, estado: "activo" },
                select: { profesorId: true, profesor: { select: { nombre: true, apellidos: true } } },
            }),
            this.db.identificadorAcudiente.findMany({
                where: { colegioId, valor, estado: "activo" },
                select: { acudienteId: true, acudiente: { select: { nombre: true } } },
            }),
        ]);

        const duenos: DuenoIdentificador[] = [];

        for (const e of estudiantes) {
            if (excluir?.sujeto === "ESTUDIANTE" && excluir.sujetoId === e.estudianteId) continue;
            duenos.push({
                sujeto: "ESTUDIANTE",
                sujetoId: e.estudianteId,
                nombre: `${e.estudiante.nombre} ${e.estudiante.apellidos}`.trim(),
                rol: "Estudiante",
            });
        }
        for (const p of profesores) {
            if (excluir?.sujeto === "PROFESOR" && excluir.sujetoId === p.profesorId) continue;
            duenos.push({
                sujeto: "PROFESOR",
                sujetoId: p.profesorId,
                nombre: `${p.profesor.nombre} ${p.profesor.apellidos}`.trim(),
                rol: "Profesor",
            });
        }
        for (const a of acudientes) {
            if (excluir?.sujeto === "ACUDIENTE" && excluir.sujetoId === a.acudienteId) continue;
            duenos.push({
                sujeto: "ACUDIENTE",
                sujetoId: a.acudienteId,
                nombre: a.acudiente.nombre,
                rol: "Acudiente",
            });
        }

        return duenos;
    }
}
