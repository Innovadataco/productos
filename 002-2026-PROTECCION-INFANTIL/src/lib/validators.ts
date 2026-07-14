import { z } from "zod";

export const crearReporteSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataforma: z.string().min(1),
    texto: z.string().min(20).max(5000),
    fechaIncidente: z.string().datetime().refine(
        (val) => new Date(val) <= new Date(),
        { message: "La fecha del incidente no puede ser futura" }
    ),
    ciudad: z.string().min(1).max(100),
    pais: z.string().min(1).max(100),
    paisId: z.string().optional(),
    ciudadId: z.string().optional(),
    otraPlataforma: z.string().max(100).optional(),
});

export type CrearReporteInput = z.infer<typeof crearReporteSchema>;
