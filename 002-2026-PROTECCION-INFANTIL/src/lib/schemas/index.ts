import { z } from "zod";

/**
 * Esquemas zod reutilizables para validación de entradas en rutas API.
 * Mantener aquí las reglas de validación comunes para evitar duplicación
 * y garantizar consistencia entre endpoints.
 */

// Identificadores y claves
export const cuidIdSchema = z.string().cuid();

export const emailSchema = z.string().email().max(255);

export const parametroClaveSchema = z.string().min(1).max(100);

// Body vacío para POST/PATCH que no esperan payload
export const emptyBodySchema = z.object({}).strict();

// Admin IA
export const ollamaProbarBodySchema = z.object({
    url: z.string().min(1).max(2000),
});

export const sandboxBodySchema = z.object({
    texto: z
        .string()
        .max(4000)
        .transform((s) => s.trim())
        .refine((s) => s.length > 0, { message: "texto es requerido" }),
    parametrosOverride: z.record(z.string(), z.unknown()).optional(),
    comparar: z.boolean().optional(),
});

// Admin operadores
export const operadorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

// Configuración / parámetros
export const parametroTipoSchema = z.enum([
    "STRING",
    "INTEGER",
    "FLOAT",
    "BOOLEAN",
    "JSON",
    "STRING_ARRAY",
]);

export const parametroCategoriaSchema = z.enum([
    "VISIBILITY",
    "SECURITY",
    "LEGAL",
    "EMAIL",
    "SYSTEM",
]);

export const parametroClaveParamsSchema = z.object({
    clave: parametroClaveSchema,
});

export const parametroPatchBodySchema = z.object({
    valor: z.string().min(1).max(4000),
    motivo: z.string().max(500).optional(),
    tipo: parametroTipoSchema.optional(),
    categoria: parametroCategoriaSchema.optional(),
    esPublico: z.boolean().optional(),
    esSecreto: z.boolean().optional(),
    descripcion: z.string().max(500).optional(),
});
