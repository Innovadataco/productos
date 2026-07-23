import { z } from "zod";
import { crearReporteSchema } from "@/lib/validators";

export const CASO_MAXIMO = 200;

export const casoSimulacionSchema = crearReporteSchema
    .omit({ paisId: true, ciudadId: true, otraPlataforma: true })
    .extend({
        categoriaEsperada: z.string().max(100).optional(),
        secundariaEsperada: z.string().max(100).optional(),
        fuente: z.string().max(100).optional(),
    });

export type CasoSimulacion = z.infer<typeof casoSimulacionSchema>;

export const MODELOS_MAXIMO = 5;

export const crearSimulacionSchema = z.object({
    modelos: z
        .array(z.string().min(1, "El modelo no puede estar vacío"))
        .min(1, "Seleccione al menos un modelo")
        .max(MODELOS_MAXIMO, `Máximo ${MODELOS_MAXIMO} modelos por corrida`),
    archivo: z.string().min(1, "El archivo es requerido"),
    formato: z.enum(["csv", "json"]),
});

export type CrearSimulacionInput = z.infer<typeof crearSimulacionSchema>;
