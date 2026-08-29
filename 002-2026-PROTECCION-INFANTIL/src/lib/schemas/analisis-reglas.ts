/**
 * SPEC-224 (002-PI-125, FR-004/FR-005/FR-009): schemas Zod de los endpoints
 * del panel de reglas configurables. Contratos en
 * `specs/224-panel-reglas-configurables/contracts/224-panel-reglas.md`.
 * La validación estática del SQL (FR-006) se aplica aparte, en el servicio,
 * tanto en test como en guardado (nunca solo en el cliente).
 */
import { z } from "zod";

/** Acciones ejecutables v1 (D-77; la ejecución real es SPEC-226). */
export const ACCIONES_EJECUTABLES = [
    "crear_bono_retencion",
    "enviar_notificacion",
    "asignar_a_operador",
    "crear_alerta_admin",
] as const;

const paginacionSchema = {
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

/** GET /api/admin/analisis/reglas */
export const listaReglasQuerySchema = z.object({
    ...paginacionSchema,
    activa: z.enum(["true", "false"]).optional(),
    q: z.string().trim().min(1).max(120).optional(),
});
export type ListaReglasQuery = z.infer<typeof listaReglasQuerySchema>;

const claveSchema = z
    .string()
    .regex(/^[a-z][a-z0-9_.-]{2,80}$/, "clave: minúsculas, dígitos, punto, guion o subrayado (3-81 chars)");
const sqlQuerySchema = z.string().min(1, "sqlQuery es obligatoria").max(10000, "sqlQuery no puede superar 10000 caracteres");
const plantillaSchema = z.string().min(1, "plantillaRecomendacion es obligatoria").max(2000, "plantillaRecomendacion no puede superar 2000 caracteres");
const motivoEdicionSchema = z
    .string()
    .trim()
    .min(10, "motivo: mínimo 10 caracteres")
    .max(500, "motivo: máximo 500 caracteres");
const motivoModoSchema = z
    .string()
    .trim()
    .min(20, "motivo: mínimo 20 caracteres")
    .max(500, "motivo: máximo 500 caracteres");

/** POST /api/admin/analisis/reglas — toda regla nace en RECOMIENDA y activa (D-77). */
export const crearReglaSchema = z.object({
    clave: claveSchema,
    nombre: z.string().trim().min(3, "nombre: mínimo 3 caracteres").max(150, "nombre: máximo 150 caracteres"),
    descripcion: z.string().trim().min(1, "descripcion es obligatoria").max(1000, "descripcion: máximo 1000 caracteres"),
    categoria: z.string().trim().min(1, "categoria es obligatoria").max(60, "categoria: máximo 60 caracteres"),
    sqlQuery: sqlQuerySchema,
    plantillaRecomendacion: plantillaSchema,
    prioridad: z.number().int().min(0, "prioridad: 0-100").max(100, "prioridad: 0-100").default(50),
    frecuenciaMin: z.number().int().min(5, "frecuenciaMin: 5-10080").max(10080, "frecuenciaMin: 5-10080").default(60),
    umbralMinimo: z.number().min(0).nullable().default(null),
    accionEjecutable: z.enum(ACCIONES_EJECUTABLES).nullable().default(null),
    accionParametros: z.record(z.string(), z.unknown()).nullable().default(null),
});
export type CrearReglaBody = z.infer<typeof crearReglaSchema>;

/**
 * PATCH /api/admin/analisis/reglas/[id] — campos funcionales editables +
 * `activa`; `motivo` obligatorio (versionado FR-010). `modo` NO es editable
 * aquí (usar /modo) y `clave` es inmutable: el servicio rechaza ambos con 400.
 */
export const editarReglaSchema = z
    .object({
        nombre: z.string().trim().min(3).max(150).optional(),
        descripcion: z.string().trim().min(1).max(1000).optional(),
        categoria: z.string().trim().min(1).max(60).optional(),
        sqlQuery: sqlQuerySchema.optional(),
        plantillaRecomendacion: plantillaSchema.optional(),
        prioridad: z.number().int().min(0).max(100).optional(),
        frecuenciaMin: z.number().int().min(5).max(10080).optional(),
        umbralMinimo: z.number().min(0).nullable().optional(),
        accionEjecutable: z.enum(ACCIONES_EJECUTABLES).nullable().optional(),
        accionParametros: z.record(z.string(), z.unknown()).nullable().optional(),
        activa: z.boolean().optional(),
        motivo: motivoEdicionSchema,
        // Capturados solo para rechazarlos con 400 explícito (contrato).
        clave: z.string().optional(),
        modo: z.string().optional(),
    })
    .strict();
export type EditarReglaBody = z.infer<typeof editarReglaSchema>;

/**
 * POST /api/admin/analisis/reglas/[id]/modo — confirmación fuerte (D-77):
 * EJECUTA exige escribir exactamente "EJECUTA" + motivo ≥ 20; RECOMIENDA
 * exige motivo ≥ 20 (salir de autonomía es la operación segura).
 */
export const cambiarModoSchema = z.discriminatedUnion("modo", [
    z.object({
        modo: z.literal("EJECUTA"),
        confirmacion: z.literal("EJECUTA"),
        motivo: motivoModoSchema,
    }),
    z.object({
        modo: z.literal("RECOMIENDA"),
        motivo: motivoModoSchema,
    }),
]);
export type CambiarModoBody = z.infer<typeof cambiarModoSchema>;

/** POST /api/admin/analisis/reglas/test-sql */
export const testSqlSchema = z.object({
    sqlQuery: sqlQuerySchema,
    reglaId: z.string().min(1).optional(),
});
export type TestSqlBody = z.infer<typeof testSqlSchema>;
