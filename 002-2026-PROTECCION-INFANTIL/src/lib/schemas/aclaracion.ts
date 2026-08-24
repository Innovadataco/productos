/**
 * SPEC-238 (002-PI-mega-cola): validación Zod de la aclaración padre-comité.
 * Textos sensibles: máximo 2000 caracteres (misma regla que los reportes);
 * nunca se devuelven en payloads públicos por defecto (D-7).
 */
import { z } from "zod";

export const estadoAclaracionExpedienteSchema = z.enum([
    "PENDIENTE",
    "RESPONDIDA",
    "CERRADA_FORZOSAMENTE",
]);

export const pedirAclaracionBodySchema = z.object({
    solicitudTexto: z
        .string()
        .trim()
        .min(1, "El texto de la aclaración es obligatorio")
        .max(2000, "El texto no puede superar 2000 caracteres"),
});

export const responderAclaracionBodySchema = z.object({
    respuestaTexto: z
        .string()
        .trim()
        .min(1, "El texto de la respuesta es obligatorio")
        .max(2000, "El texto no puede superar 2000 caracteres"),
});
