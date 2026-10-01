/**
 * SPEC-391 · Zod schemas del perfil profesional.
 *
 * Todos opcionales — el profesional rellena en varias visitas antes de mandar
 * a revisión. La validación de «completo para EN_REVISION» vive en
 * `perfilCompletoParaRevision` del `dto.ts`, no en el schema (Zod dice qué es
 * VÁLIDO; el estado se calcula aparte). Aquí solo se protege contra basura.
 */
import { z } from "zod";

export const perfilProfesionalUpdateSchema = z
    .object({
        nombreVisible: z.string().trim().min(1, "Escriba cómo quiere que lo vean").max(120).optional(),
        fotoUrl: z.string().url().max(2048).nullable().optional(),
        // SPEC-786 · `tituloProfesional`/`especialidades` son SALIDA, no entrada: los CALCULA el
        // derivador NUEVO→legacy (`validarYderivarLegado`) desde `profesion`/`areasAtencion`, para
        // los lectores legado. El schema conserva su FORMA porque la RUTA los ESCRIBE con el valor
        // DERIVADO — pero el PUT NO los recibe: aceptarlos era una puerta que nunca debió existir
        // (el llamador dictando un valor que el sistema deriva) y un hueco silencioso (un payload
        // solo-legacy respondía 200 sin derivar nada → el perfil quedaba en BORRADOR para siempre).
        // El `superRefine` de abajo los RECHAZA como entrada. No se deriva legacy→nuevo: los viejos
        // son texto libre y los nuevos enumerados; inventar estructura metería datos falsos en el
        // perfil que decide quién atiende a un menor.
        tituloProfesional: z.string().trim().max(150).optional(),
        especialidades: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        // SPEC-685 (PR2) · listas cerradas. El schema solo valida la FORMA (claves
        // no vacías); la PERTENENCIA al catálogo la comprueba la ruta contra el
        // parámetro vivo (un gate contra un valor del cliente falla abierto).
        profesion: z.string().trim().min(1).max(80).optional(),
        areasAtencion: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
        rangoEtario: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
        ciudadId: z.string().min(1, "Elija su ciudad").optional(),
        atiendeVirtual: z.boolean().optional(),
        atiendePresencial: z.boolean().optional(),
        aniosExperiencia: z.number().int().min(0).max(80).optional(),
        presentacion: z.string().trim().min(20, "Cuénteles a los padres quién es, en pocas palabras").max(1500).optional(),
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
    })
    // SPEC-786 · un endpoint no puede responder ÉXITO por un payload sobre el que no puede actuar.
    // Las claves DERIVADAS no se reciben: si vienen, es un llamador hablando un dialecto que el
    // endpoint ya no ejecuta → rechazo explícito con el motivo (qué mandar), no un 200 silencioso.
    .superRefine((d, ctx) => {
        if (d.tituloProfesional !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["tituloProfesional"],
                message: "El sistema calcula el título desde `profesion`; no envíes `tituloProfesional`. Enviá `profesion`.",
            });
        }
        if (d.especialidades !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["especialidades"],
                message: "El sistema calcula las especialidades desde `areasAtencion`; no envíes `especialidades`. Enviá `areasAtencion`.",
            });
        }
    });

export type PerfilProfesionalUpdateInput = z.infer<typeof perfilProfesionalUpdateSchema>;
