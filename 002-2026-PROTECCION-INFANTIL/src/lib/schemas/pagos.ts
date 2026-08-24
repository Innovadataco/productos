/**
 * Esquemas Zod para el módulo de pagos (SPEC-212/214).
 */
import { z } from "zod";

// SPEC-212 (002-PI-112): panel administrativo de pagos.
export const pagosQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(2).max(120).optional(),
});

export const pagosVencimientosQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    dias: z.coerce.number().int().min(1).max(90).default(7),
});

export const pagosMoraQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["EN_GRACIA", "SUSPENDIDA"]).optional(),
});

export const pagosBonoBodySchema = z.object({
    nombre: z.string().min(2).max(100),
    tipo: z.enum(["DESCUENTO_PCT", "DESCUENTO_FIJO_USD", "MESES_GRATIS"]),
    valor: z.coerce.number().positive(),
    vigenciaInicio: z.string().datetime(),
    vigenciaFin: z.string().datetime(),
    usosMaximosTotales: z.coerce.number().int().min(1).optional(),
    usosMaximosPorCliente: z.coerce.number().int().min(1).default(1),
    aplicaANuevos: z.boolean().default(true),
    aplicaARenovaciones: z.boolean().default(false),
    aplicaSoloA: z.enum(["COLEGIO", "PADRE"]).optional(),
    combinableConCodigoPersonal: z.boolean().default(false),
    descripcion: z.string().max(500).optional(),
});

export const pagosBonoUpdateSchema = pagosBonoBodySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
);

export const pagosPlanUpdateSchema = z.object({
    precioBaseUSD: z.coerce.number().positive().optional(),
    descuentoAnualPct: z.coerce.number().min(0).max(100).nullable().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
);

export const pagosReembolsoBodySchema = z.object({
    montoReembolsoUSD: z.coerce.number().positive(),
    motivoReembolso: z.string().min(10).max(500),
    referenciaReembolso: z.string().min(1).max(200),
});

export const pagosExtenderBodySchema = z.object({
    nuevaFechaFin: z.string().datetime(),
    motivo: z.string().min(10).max(500),
});

// SPEC-216 (002-PI-116): aplicación de bono promocional a una suscripción.
export const pagosAplicarBonoBodySchema = z.object({
    suscripcionId: z.string().min(1),
    bonoId: z.string().min(1),
    montoBaseUSD: z.coerce.number().positive(),
});

// SPEC-214 (002-PI-114): tasas de cambio.
export const pagosTasaManualBodySchema = z.object({
    monedaDestino: z.string().min(3).max(3).toUpperCase(),
    tasa: z.coerce.number().positive(),
    motivoManual: z.string().min(10).max(500),
});

// SPEC-211 (002-PI-111): campos del formulario de renovación (multipart/form-data;
// el archivo `comprobante` se valida aparte en el servicio).
export const pagosRenovacionCamposSchema = z.object({
    suscripcionId: z.string().min(1),
    duracion: z.enum(["MES_1", "MES_2", "MES_3", "MES_6", "MES_12"]),
    metodoDeclarado: z.enum(["TRANSFERENCIA", "NEQUI", "DAVIPLATA", "PSE_MANUAL", "EFECTIVO", "CHEQUE", "OTRO"]),
    notas: z.string().trim().max(500).optional(),
    codigoReferido: z.string().trim().max(50).optional(),
    codigoBono: z.string().trim().max(100).optional(),
});

// SPEC-211 (002-PI-111): cancelación de la suscripción por el cliente.
export const pagosCancelarSuscripcionBodySchema = z.object({
    suscripcionId: z.string().min(1),
    motivo: z.string().trim().max(500).optional(),
});
