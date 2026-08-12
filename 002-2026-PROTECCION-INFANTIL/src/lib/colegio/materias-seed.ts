/**
 * SPEC-162: catálogo inicial de materias por colegio.
 * Idempotente: puede re-correrse sin duplicar gracias a la unique constraint
 * `(colegioId, nombre)`.
 */
import type { DbClient } from "@/lib/dal/unit-of-work";

export const MATERIAS_POR_DEFECTO = [
    "Matemáticas",
    "Español",
    "Inglés",
    "Ciencias Sociales",
    "Ciencias Naturales",
    "Física",
    "Química",
    "Biología",
    "Filosofía",
    "Religión",
    "Educación Artística",
    "Educación Física",
    "Tecnología e Informática",
    "Ética y Valores",
    "Música",
];

export async function seedMateriasPorDefecto(db: DbClient, colegioId: string): Promise<number> {
    const data = MATERIAS_POR_DEFECTO.map((nombre) => ({
        colegioId,
        nombre,
        estado: "activo" as const,
    }));

    const resultado = await db.materia.createMany({
        data,
        skipDuplicates: true,
    });

    return resultado.count;
}
