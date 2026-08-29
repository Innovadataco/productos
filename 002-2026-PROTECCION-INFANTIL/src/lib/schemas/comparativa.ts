import { z } from "zod";

export const comparativaQuerySchema = z.object({
    agruparPor: z.enum(["grado", "anioLectivo"]).default("grado"),
});

export type ComparativaQueryInput = z.infer<typeof comparativaQuerySchema>;
