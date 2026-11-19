import { z } from "zod";
import { cuidIdSchema } from "./base";

/** Un parámetro de consulta vacío («Todos los cursos», búsqueda en blanco) = ausente, no inválido. */
const vacioComoAusente = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/**
 * SPEC-931: consulta del listado del COLEGIO (Usuarios → Estudiantes). El colegio NO viaja: sale de la
 * sesión. `cursoId` solo ACOTA dentro de ese colegio (un curso ajeno da lista vacía, nunca datos ajenos).
 * Paginación estándar (`page`/`pageSize`, 25 por defecto, máx. 100).
 */
export const estudiantesColegioQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.preprocess(vacioComoAusente, z.string().trim().min(2).max(120).optional()),
    cursoId: z.preprocess(vacioComoAusente, cuidIdSchema.optional()),
});
