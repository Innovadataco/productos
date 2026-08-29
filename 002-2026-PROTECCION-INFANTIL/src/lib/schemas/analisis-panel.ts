/**
 * SPEC-222 (002-PI-123): schemas Zod de los endpoints del panel principal
 * Análisis (Dinero vs Valor). Contratos en `contracts/222-panel-analisis.md`.
 */
import { z } from "zod";

export const GRANULARIDADES_PANEL = ["pais", "ciudad", "colegio", "padre", "plan", "cohorte", "canal"] as const;
export type GranularidadPanel = (typeof GRANULARIDADES_PANEL)[number];

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const periodoSchema = z.enum(["mes", "trimestre", "anio", "custom"]).default("mes");
const fechaOpcionalSchema = z.string().regex(FECHA_ISO, "formato esperado YYYY-MM-DD").optional();
const paginacionSchema = {
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

/** Filtros globales compartidos por dinero-vs-valor, dispersión y KPIs. */
const filtrosPeriodoSchema = z
    .object({
        periodo: periodoSchema,
        desde: fechaOpcionalSchema,
        hasta: fechaOpcionalSchema,
    })
    .superRefine((val, ctx) => {
        if (val.periodo === "custom") {
            if (!val.desde || !val.hasta) {
                ctx.addIssue({ code: "custom", message: "periodo=custom requiere desde y hasta", path: ["desde"] });
                return;
            }
            if (val.desde > val.hasta) {
                ctx.addIssue({ code: "custom", message: "desde no puede ser posterior a hasta", path: ["desde"] });
            }
        }
    });

/** GET /api/admin/analisis/dinero-vs-valor */
export const dineroVsValorQuerySchema = filtrosPeriodoSchema.extend({
    granularidad: z.enum(GRANULARIDADES_PANEL).default("pais"),
    estado: z.enum(["ACTIVA", "EN_GRACIA", "SUSPENDIDA", "CANCELADA", "todas"]).default("todas"),
    tipoTitular: z.enum(["COLEGIO", "PADRE", "ambos"]).default("ambos"),
    paisId: z.string().min(1).optional(),
    ciudadId: z.string().min(1).optional(),
    colegioId: z.string().min(1).optional(),
    ...paginacionSchema,
});
export type DineroVsValorQuery = z.infer<typeof dineroVsValorQuerySchema>;

/** GET /api/admin/analisis/dispersion */
export const dispersionQuerySchema = filtrosPeriodoSchema.extend({
    estado: z.enum(["ACTIVA", "EN_GRACIA", "SUSPENDIDA", "CANCELADA", "todas"]).default("todas"),
    tipoTitular: z.enum(["COLEGIO", "PADRE", "ambos"]).default("ambos"),
});
export type DispersionQuery = z.infer<typeof dispersionQuerySchema>;

/** GET /api/admin/analisis/kpis */
export const kpisQuerySchema = filtrosPeriodoSchema;
export type KpisQuery = z.infer<typeof kpisQuerySchema>;

/** GET /api/admin/analisis/anomalias */
export const anomaliasQuerySchema = z.object({
    severidad: z.enum(["ALTA", "MEDIA", "BAJA", "todas"]).default("todas"),
    ...paginacionSchema,
});
export type AnomaliasQuery = z.infer<typeof anomaliasQuerySchema>;

/**
 * Parsea el querystring de un Request contra un schema Zod. Devuelve el
 * objeto validado o lanza `ZodError` (lo convierte `errorToResponse` en 400).
 */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
    const params = new URL(request.url).searchParams;
    const crudo: Record<string, string> = {};
    params.forEach((valor, clave) => {
        crudo[clave] = valor;
    });
    return schema.parse(crudo);
}
