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

// SPEC-243 (002-PI-146): listado paginado de planes con filtros por rol y año.
export const pagosPlanesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    tipoTitular: z.enum(["COLEGIO", "PADRE"]).optional(),
    anio: z.coerce.number().int().min(2000).max(2100).optional(),
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
    nombre: z.string().min(2).max(120).optional(),
    precioBaseCOP: z.coerce.number().min(0).optional(),
    precioBaseUSD: z.coerce.number().positive().optional(),
    descuentoAnualPct: z.coerce.number().min(0).max(100).nullable().optional(),
    descripcion: z.string().max(500).nullable().optional(),
    activo: z.boolean().optional(),
    usosMaximosPorCliente: z.coerce.number().int().min(1).nullable().optional(),
    esFreemium: z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Debe enviar al menos un campo para actualizar", path: ["root"] }
);

const DURACIONES_PLAN = ["MES_1", "MES_2", "MES_3", "MES_6", "MES_12"] as const;
const TIPOS_TITULAR = ["COLEGIO", "PADRE"] as const;

export const pagosPlanCreateSchema = z.object({
    nombre: z.string().min(2).max(120),
    precioBaseCOP: z.coerce.number().min(0),
    precioBaseUSD: z.coerce.number().positive(),
    duracion: z.enum(DURACIONES_PLAN),
    tipoTitular: z.enum(TIPOS_TITULAR),
    anio: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
    descripcion: z.string().max(500).optional(),
    activo: z.boolean().default(true),
    usosMaximosPorCliente: z.coerce.number().int().min(1).nullable().optional(),
    esFreemium: z.boolean().default(false),
    descuentoAnualPct: z.coerce.number().min(0).max(100).nullable().optional(),
}).refine(
    (data) => {
        if (data.esFreemium) {
            return data.precioBaseCOP === 0 && (data.usosMaximosPorCliente ?? 0) >= 1;
        }
        return data.precioBaseCOP > 0;
    },
    {
        message: "Plan freemium requiere precio 0 y al menos 1 uso máximo; planes pagos requieren precio mayor a 0",
        path: ["precioBaseCOP"],
    }
);

export const pagosParametrosUpdateSchema = z.object({
    "pagos.iva.porcentaje": z.coerce.number().min(0).max(100),
    "pagos.iva.aplica_a": z.enum(["todos", "solo_colegios", "solo_padres", "ninguno"]),
    "pagos.freemium.activo": z.boolean(),
    "pagos.freemium.duracion_dias": z.coerce.number().int().min(1),
    "pagos.recompensa.activa": z.boolean(),
    "pagos.recompensa.meses_gratis": z.coerce.number().int().min(0).max(12),
    "pagos.recompensa.max_por_año": z.coerce.number().int().min(0).max(100),
});

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

// SPEC-215 (002-PI-115): aplicación de un código de referido a la suscripción propia.
export const pagosAplicarReferidoBodySchema = z.object({
    suscripcionId: z.string().cuid(),
    codigoReferido: z.string().trim().min(1).max(20),
});

// SPEC-244 (002-PI-147): solicitud de plan por cliente (padre o colegio).
export const pagosSolicitarPlanBodySchema = z.object({
    planId: z.string().cuid(),
    codigoBono: z.string().trim().max(100).optional(),
});

// SPEC-244 (002-PI-147): activación autónoma de freemium por padre.
export const pagosActivarFreemiumBodySchema = z.object({
    aceptaTerminos: z.boolean().refine((v) => v === true, {
        message: "Debe aceptar los términos de la prueba gratis",
    }),
});

// SPEC-245 (002-PI-148): listado de targets sin suscripción vigente.
export const pagosSinSuscripcionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    tipo: z.enum(["PADRE", "COLEGIO"]).optional(),
    q: z.string().trim().min(2).max(120).optional(),
});

// SPEC-245 (002-PI-148): listado de solicitudes PENDIENTE_AUTORIZACION.
export const pagosSolicitudesPendientesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(2).max(120).optional(),
});

// SPEC-245 (002-PI-148): activación manual de suscripción por admin.
export const pagosActivarManualBodySchema = z.object({
    usuarioObjetivoId: z.string().cuid().optional(),
    colegioObjetivoId: z.string().cuid().optional(),
    planId: z.string().cuid(),
    metodoPagoManual: z.enum(["TRANSFERENCIA_BANCARIA", "EFECTIVO", "CHEQUE", "OTRO"]),
    referenciaPagoManual: z.string().trim().min(1).max(200),
    montoRealPagado: z.coerce.number().min(0),
    fechaPagoReal: z.string().datetime().optional(),
}).refine(
    (data) => Boolean(data.usuarioObjetivoId) !== Boolean(data.colegioObjetivoId),
    { message: "Debe especificar usuarioObjetivoId O colegioObjetivoId, no ambos ni ninguno", path: ["root"] }
);

// SPEC-245 (002-PI-148): autorización de solicitud pendiente por admin.
export const pagosAutorizarSolicitudBodySchema = z.object({
    metodoPagoManual: z.enum(["TRANSFERENCIA_BANCARIA", "EFECTIVO", "CHEQUE", "OTRO"]),
    referenciaPagoManual: z.string().trim().min(1).max(200),
    montoRealPagado: z.coerce.number().min(0),
    fechaPagoReal: z.string().datetime().optional(),
});
