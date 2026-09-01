/**
 * SPEC-344 (A-69 · C1 · D-5): al crear un colegio, sembramos los 11 grados
 * del año lectivo vigente. El rector no digita nada — abre el Paso 4 y ya los
 * ve; puede inactivar los que no aplican o dividir en A/B.
 *
 * Idempotente: usa el `@@unique([colegioId, nombre, grado, anioLectivo])` del
 * modelo `Curso` (`prisma/schema.prisma:1235`). Re-ejecutar no crea duplicados.
 */
import type { PrismaClient } from "@prisma/client";

// Q-3: este módulo NO importa `@/lib/prisma`. El caller obligado a inyectar
// el cliente (o una transacción) lo trae desde el DAL.
type PrismaLike = { curso: PrismaClient["curso"] };

/** Los 11 grados canónicos. Nombres estables para el índice único. */
const GRADOS = Array.from({ length: 11 }, (_, i) => String(i + 1));

/**
 * Siembra los 11 cursos ("Grado 1º" … "Grado 11º") del año lectivo dado.
 * Idempotente. Devuelve el número de cursos ACTIVOS del colegio tras la
 * operación (11 en el caso normal).
 */
export async function crearCursosPorDefecto(
    colegioId: string,
    anioLectivo: string,
    cliente: PrismaLike,
): Promise<number> {
    for (const grado of GRADOS) {
        const nombre = `Grado ${grado}º`;
        // upsert emulado con findFirst → create (no hay unique compuesto
        // expuesto en el cliente Prisma para findUnique; usamos where compuesto).
        const existente = await cliente.curso.findFirst({
            where: { colegioId, nombre, grado, anioLectivo },
            select: { id: true, estado: true },
        });
        if (existente) continue;
        await cliente.curso.create({
            data: {
                colegioId,
                nombre,
                grado,
                anioLectivo,
                estado: "activo",
            },
        });
    }

    return cliente.curso.count({ where: { colegioId, estado: "activo" } });
}
