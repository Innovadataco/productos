/**
 * SPEC-344 (A-69 · C1 · D-5) — Importador de la carga por Excel de profesores.
 *
 * Consume el resultado del validador (`filas en estado "crear"`), persiste
 * cada profesor dentro de la misma `withUnitOfWork`, y devuelve el conteo
 * junto con los IDs creados. Idempotente en carreras: si un documento se
 * duplicó entre validar y confirmar, la restricción única `@@unique(
 * [colegioId, tipoDocumento, numeroDocumento])` del schema lanza P2002 y lo
 * omitimos con un contador aparte.
 */
import type { Prisma } from "@prisma/client";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import type { ProfesorNormalizado } from "./validator";

export interface ResultadoImport {
    creados: number;
    duplicadosRace: number;
    profesores: Array<{ id: string; nombre: string; apellidos: string; numeroDocumento: string }>;
}

export async function importarCargaProfesores(
    colegioId: string,
    profesores: ProfesorNormalizado[],
): Promise<ResultadoImport> {
    const creados: ResultadoImport["profesores"] = [];
    let duplicadosRace = 0;

    await withUnitOfWork(async (tx) => {
        const repo = new ProfesorRepository(tx);
        for (const p of profesores) {
            try {
                const creado = await repo.crear(colegioId, {
                    nombre: p.nombre,
                    apellidos: p.apellidos,
                    tipoDocumento: p.tipoDocumento,
                    numeroDocumento: p.numeroDocumento,
                    anioNacimiento: p.anioNacimiento,
                    sexo: p.sexo,
                    email: p.email,
                    telefono: p.telefono,
                });
                creados.push({
                    id: creado.id,
                    nombre: creado.nombre,
                    apellidos: creado.apellidos,
                    numeroDocumento: creado.numeroDocumento,
                });
            } catch (err) {
                // P2002 = restricción única violada — es la carrera entre
                // validar y confirmar (otro proceso creó el mismo documento
                // en el tiempo intermedio). Otras violaciones se propagan.
                if (isPrismaUniqueError(err)) {
                    duplicadosRace++;
                    continue;
                }
                throw err;
            }
        }
    });

    return { creados: creados.length, duplicadosRace, profesores: creados };
}

function isPrismaUniqueError(err: unknown): boolean {
    const e = err as { code?: unknown };
    return typeof e === "object" && e !== null && e.code === "P2002";
}

/**
 * Helper: usado por el schema del test-candado y por los endpoints para tener
 * el mismo tipo de `Prisma.ProfesorCreateInput` que espera el repo.
 */
export type ProfesorCreateInput = Prisma.ProfesorUncheckedCreateInput;
