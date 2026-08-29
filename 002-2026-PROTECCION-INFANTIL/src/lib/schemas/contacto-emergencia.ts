/**
 * SPEC-239 (002-PI-mega-cola): schemas Zod de contactos de emergencia (FR-007).
 * Teléfono en formato E.164 (candado del instructivo, D2): `+` seguido de
 * 2..15 dígitos, el primero distinto de cero.
 */
import { z } from "zod";

export const telefonoE164Schema = z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Teléfono debe estar en formato E.164 (ej. +573001234567)");

export const relacionContactoEmergenciaSchema = z.enum(["MADRE", "PADRE", "TUTOR", "HERMANO", "OTRO"]);

export const contactoEmergenciaBodySchema = z.object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(100),
    relacion: relacionContactoEmergenciaSchema,
    telefono: telefonoE164Schema,
    email: z.string().email("Email inválido").max(254).optional(),
    prioridad: z.number().int().min(1, "La prioridad mínima es 1").max(3, "La prioridad máxima es 3"),
});

export const contactoEmergenciaUpdateSchema = contactoEmergenciaBodySchema.partial().extend({
    activo: z.boolean().optional(),
});

export const contactoEmergenciaQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    incluirInactivos: z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true"),
});
