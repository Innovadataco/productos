/**
 * SPEC-391 · Zod schemas del perfil profesional.
 *
 * Todos opcionales — el profesional rellena en varias visitas antes de mandar
 * a revisión. La validación de «completo para EN_REVISION» vive en
 * `perfilCompletoParaRevision` del `dto.ts`, no en el schema (Zod dice qué es
 * VÁLIDO; el estado se calcula aparte). Aquí solo se protege contra basura.
 */
import { z } from "zod";

export const perfilProfesionalUpdateSchema = z.object({
    nombreVisible: z.string().trim().min(1, "Escribe cómo querés que te vean").max(120).optional(),
    fotoUrl: z.string().url().max(2048).nullable().optional(),
    tituloProfesional: z.string().trim().min(1, "Escribe tu título profesional").max(150).optional(),
    especialidades: z.array(z.string().trim().min(1).max(80)).min(1, "Elegí al menos una especialidad").max(20).optional(),
    ciudadId: z.string().min(1, "Elegí tu ciudad").optional(),
    atiendeVirtual: z.boolean().optional(),
    atiendePresencial: z.boolean().optional(),
    aniosExperiencia: z.number().int().min(0).max(80).optional(),
    presentacion: z.string().trim().min(20, "Contale a los padres quién sos, en pocas palabras").max(1500).optional(),
    tarifaConsultaCOP: z.number().int().min(1).max(10_000_000).optional(),
    duracionMinutos: z.number().int().min(15).max(240).optional(),
    emiteFactura: z.boolean().optional(),
    // Internos — los pide el mismo formulario del profesional, pero salen SOLO
    // hacia el admin en L2 (nunca al DTO público).
    numeroTarjetaProfesional: z.string().trim().max(50).nullable().optional(),
    datosFacturacion: z
        .object({
            razonSocial: z.string().trim().max(200).optional(),
            nit: z.string().trim().max(50).optional(),
            direccion: z.string().trim().max(300).optional(),
        })
        .optional(),
});

export type PerfilProfesionalUpdateInput = z.infer<typeof perfilProfesionalUpdateSchema>;
