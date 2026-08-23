/**
 * SPEC-235 (002-PI-135): validadores Zod para guías de acción.
 */
import { z } from "zod";
import { cuidIdSchema } from "./index";

export const tipoPasoGuiaSchema = z.enum(["TRANQUILIDAD", "ATENCION", "ACCION", "URGENCIA"]);

export const pasoGuiaSchema = z.object({
    orden: z.number().int().min(1).max(50),
    tipo: tipoPasoGuiaSchema,
    titulo: z.string().min(1).max(200),
    descripcion: z.string().min(1).max(1000),
});

export const botonAccionGuiaSchema = z.object({
    tipo: z.enum(["tel", "url"]),
    texto: z.string().min(1).max(120),
    subtexto: z.string().max(200).optional(),
    valor: z.string().min(1).max(500),
    estilo: z.enum(["primario", "urgente", "secundario"]),
});

export const votoComiteGuiaSchema = z.object({
    usuarioId: cuidIdSchema,
    email: z.string().email().max(255),
    nombre: z.string().max(255).optional(),
    aprobadoEn: z.string().datetime({ offset: true }),
});

export const guiaAccionCrearBodySchema = z.object({
    categoria: z.string().min(1).max(100),
    tituloEmocional: z.string().min(1).max(200),
    subtitulo: z.string().max(500).optional(),
    categoriaBadgeTexto: z.string().min(1).max(200),
    pasosJson: z.array(pasoGuiaSchema).min(1).max(20),
    calloutTitulo: z.string().max(200).optional(),
    calloutTexto: z.string().max(1000).optional(),
    botonesAccionJson: z.array(botonAccionGuiaSchema).min(1).max(10),
    piePagina: z.string().max(1000).optional(),
});

export const guiaAccionEditarBodySchema = guiaAccionCrearBodySchema
    .omit({ categoria: true })
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        message: "Debe enviar al menos un campo para actualizar",
        path: ["root"],
    });

export const guiaAccionIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const guiaAccionRechazarBodySchema = z.object({
    motivo: z.string().min(1).max(1000),
});

export const categoriaGuiaPublicaParamsSchema = z.object({
    cat: z.string().min(1).max(100),
});
