/**
 * SPEC-226 (002-PI-mega-cola): esquemas Zod de `accionParametros` por tipo de
 * acción ejecutable. Una regla con parámetros inválidos falla en ejecución
 * (registrado como FALLIDA con motivo de validación); la corrección se hace
 * editando la regla (SPEC-224).
 */
import { z } from "zod";

export const crearBonoSchema = z.object({
    tipoBono: z.enum(["DESCUENTO_PCT", "DESCUENTO_FIJO_USD", "MESES_GRATIS"]),
    valor: z.number().positive("valor debe ser > 0"),
    vigenciaDias: z.number().int("vigenciaDias debe ser entero").min(1).max(365),
});

export const enviarNotificacionSchema = z.object({
    evento: z.string().min(1).max(120),
    variables: z.record(z.string(), z.unknown()).optional(),
});

export const asignarOperadorSchema = z
    .object({
        operadorId: z.string().min(1).optional(),
        estrategia: z.literal("menor_carga").optional(),
    })
    .refine((val) => (val.operadorId ? !val.estrategia : !!val.estrategia), {
        message: "envía exactamente uno de: operadorId, estrategia",
    });

export const crearAlertaSchema = z.object({
    severidad: z.enum(["ALTA", "MEDIA", "BAJA"]),
    mensaje: z.string().min(1).max(500),
    datosContexto: z.record(z.string(), z.unknown()).optional(),
});

export type CrearBonoParams = z.infer<typeof crearBonoSchema>;
export type EnviarNotificacionParams = z.infer<typeof enviarNotificacionSchema>;
export type AsignarOperadorParams = z.infer<typeof asignarOperadorSchema>;
export type CrearAlertaParams = z.infer<typeof crearAlertaSchema>;
