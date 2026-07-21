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

// Colegios
export const tipoPeriodoServicioSchema = z.enum(["MENSUAL", "SEMESTRAL", "ANUAL"]);

export const colegioBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    paisId: cuidIdSchema,
    departamentoId: cuidIdSchema.optional(),
    ciudadId: cuidIdSchema,
    direccion: z.string().max(255).optional(),
    representanteLegalNombre: z.string().min(2).max(150),
    representanteLegalIdentificacion: z.string().min(1).max(50),
    representanteLegalEmail: emailSchema,
    representanteLegalTelefono: z.string().max(50).optional(),
    inicioServicio: z.string().datetime(),
    finServicio: z.string().datetime(),
    tipoPeriodo: tipoPeriodoServicioSchema,
    adminEmail: emailSchema,
    adminNombre: z.string().min(2).max(150),
});

export const colegioIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const colegioUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    paisId: cuidIdSchema.optional(),
    departamentoId: cuidIdSchema.optional().nullable(),
    ciudadId: cuidIdSchema.optional(),
    direccion: z.string().max(255).optional().nullable(),
    representanteLegalNombre: z.string().min(2).max(150).optional(),
    representanteLegalIdentificacion: z.string().min(1).max(50).optional(),
    representanteLegalEmail: emailSchema.optional(),
    representanteLegalTelefono: z.string().max(50).optional().nullable(),
    inicioServicio: z.string().datetime().optional(),
    finServicio: z.string().datetime().optional().nullable(),
    tipoPeriodo: tipoPeriodoServicioSchema.optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const estadoActivoSchema = z.enum(["activo", "inactivo"]);

export const cursoBodySchema = z.object({
    nombre: z.string().min(2).max(150),
    grado: z.string().max(100).optional(),
    anioLectivo: z.string().max(20).optional(),
});

export const cursoUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
    grado: z.string().max(100).optional().nullable(),
    anioLectivo: z.string().max(20).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const cursoIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const alumnoBodySchema = z.object({
    nombre: z.string().min(2).max(150),
});

export const alumnoUpdateBodySchema = z.object({
    nombre: z.string().min(2).max(150).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const alumnoIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const etiquetaRelacionAlumnoSchema = z.enum(["ALUMNO", "MADRE", "PADRE", "PRIMO", "TUTOR", "OTRO"]);

export const identificadorAlumnoBodySchema = z.object({
    tipo: z.string().min(1).max(50),
    valor: z.string().min(1).max(255),
    plataformaId: cuidIdSchema.optional(),
    etiquetaRelacion: etiquetaRelacionAlumnoSchema.optional(),
});

export const identificadorAlumnoUpdateBodySchema = z.object({
    tipo: z.string().min(1).max(50).optional(),
    valor: z.string().min(1).max(255).optional(),
    plataformaId: cuidIdSchema.optional().nullable(),
    etiquetaRelacion: etiquetaRelacionAlumnoSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

export const identificadorAlumnoIdParamsSchema = z.object({
    id: cuidIdSchema,
});
