import { z } from "zod";
import { crearReporteSchema } from "@/lib/validators";

export const CASO_MAXIMO = 200;

export const casoSimulacionSchema = crearReporteSchema
    .omit({ paisId: true, ciudadId: true, otraPlataforma: true })
    .extend({
        categoriaEsperada: z.string().max(100).optional(),
    });

export type CasoSimulacion = z.infer<typeof casoSimulacionSchema>;

export const crearSimulacionSchema = z.object({
    modelo: z.string().min(1, "El modelo es requerido"),
    archivo: z.string().min(1, "El archivo es requerido"),
    formato: z.enum(["csv", "json"]),
});

export type CrearSimulacionInput = z.infer<typeof crearSimulacionSchema>;
