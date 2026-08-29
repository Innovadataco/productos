import { z } from "zod";

export const auditoriaConfianzaSchema = z.object({
    dias: z.coerce.number().int().min(1).max(90).default(90),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditoriaConfianzaQuery = z.infer<typeof auditoriaConfianzaSchema>;
