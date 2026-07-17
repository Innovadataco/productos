import { z } from "zod";
import { CategoriaConducta, EstadoReporte, AccionAudit, MotivoBajaReporte } from "@prisma/client";

const motivosBaja = Object.values(MotivoBajaReporte) as [string, ...string[]];
export const darDeBajaReporteSchema = z.object({
    motivo: z.enum(motivosBaja),
    nota: z.string().min(1).max(2000),
});
export type DarDeBajaReporteInput = z.infer<typeof darDeBajaReporteSchema>;

export const reactivarReporteSchema = z.object({
    nota: z.string().min(1).max(2000),
});
export type ReactivarReporteInput = z.infer<typeof reactivarReporteSchema>;

export const crearReporteSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
    texto: z.string().min(20).max(5000),
    fechaIncidente: z.string().datetime().refine(
        (val) => new Date(val) <= new Date(),
        { message: "La fecha del incidente no puede ser futura" }
    ),
    ciudad: z.string().min(1).max(100),
    pais: z.string().min(1).max(100),
    paisId: z.string().optional(),
    ciudadId: z.string().optional(),
    otraPlataforma: z.string().max(100).optional(),
    edadVictima: z.number().int().min(0).max(120).optional(),
});

export type CrearReporteInput = z.infer<typeof crearReporteSchema>;

// IDs de Prisma: cuid() comienza con "c" y tiene 25 chars; también aceptamos UUIDs por compatibilidad.
export const idSchema = z.string().refine(
    (val) => /^[a-z0-9]{25}$/i.test(val) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
    { message: "ID inválido" }
);

export const numeroSeguimientoSchema = z.string().regex(/^RPT-[A-Z0-9]{6}$/, "Número de seguimiento inválido");

const accionesPermitidas = Object.values(AccionAudit) as [string, ...string[]];
export const auditLogsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    accion: z.enum(accionesPermitidas).optional(),
    usuarioId: idSchema.optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
});

const estadosPermitidos = Object.values(EstadoReporte) as [string, ...string[]];
const categoriasPermitidas = Object.values(CategoriaConducta) as [string, ...string[]];

export const reportesRevisionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(estadosPermitidos).optional(),
    plataformaId: idSchema.optional(),
    categoria: z.enum(categoriasPermitidas).optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
    incluirEliminados: z.coerce.boolean().default(false),
});
