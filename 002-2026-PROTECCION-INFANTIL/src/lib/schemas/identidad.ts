import { z } from "zod";
import { cuidIdSchema, emailSchema, estadoActivoSchema } from "./base";

/**
 * SPEC-320 (§2.2): esquemas de identidad del profesor. Extraídos de `index.ts`
 * (límite de líneas) e importados desde `./base` para evitar ciclos. Re-exportados
 * por `index.ts` (`export * from "./identidad"`), así los consumidores siguen
 * usando `@/lib/schemas`.
 */

// Sexo del profesor (set cerrado).
export const sexoSchema = z.enum(["M", "F", "OTRO"], {
    message: "Sexo inválido. Valores aceptados: M, F, OTRO",
});

// SPEC-145 (FR-005) + SPEC-320 (§2.2): alta de profesor. Identidad OBLIGATORIA
// (tipo/número de documento, año de nacimiento, sexo, email y teléfono).
// tipoDocumento se valida además contra el catálogo TipoDocumento (clave activa) en la ruta.
export const profesorBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    apellidos: z.string({ message: "Falta el apellido del profesor" }).min(1, "Falta el apellido del profesor").max(150),
    tipoDocumento: z.string({ message: "Falta el tipo de documento del profesor" }).min(1, "Falta el tipo de documento del profesor").max(20),
    numeroDocumento: z.string({ message: "Falta el número de documento del profesor" }).min(1, "Falta el número de documento del profesor").max(50),
    anioNacimiento: z.coerce.number({ message: "Falta el año de nacimiento del profesor" }).int().gte(1900, "Año de nacimiento inválido").lte(new Date().getFullYear(), "Año de nacimiento inválido"),
    sexo: sexoSchema,
    email: emailSchema,
    telefono: z.string({ message: "Falta el teléfono del profesor" }).min(1, "Falta el teléfono del profesor").max(50),
});

export const profesorPatchSchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    apellidos: z.string().min(1).max(150).optional(),
    // SPEC-320 (§2.2): email/telefono ya no admiten null (identidad obligatoria).
    email: emailSchema.optional(),
    telefono: z.string().min(1).max(50).optional(),
    estado: estadoActivoSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const profesorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const profesoresQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["activo", "inactivo", "todos"]).default("activo"),
});

// SPEC-146: alta rápida de profesor en el wizard unificado (solo nombre+apellidos).
export const profesorNuevoSchema = profesorBodySchema.pick({ nombre: true, apellidos: true });
