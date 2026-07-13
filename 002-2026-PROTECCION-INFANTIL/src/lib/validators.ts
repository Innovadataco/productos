import { z } from "zod";

export const crearReporteSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
    texto: z.string().min(20).max(5000),
    fechaIncidente: z.string().datetime(),
    ciudad: z.string().min(1).max(100),
    pais: z.string().min(1).max(100),
});

export type CrearReporteInput = z.infer<typeof crearReporteSchema>;