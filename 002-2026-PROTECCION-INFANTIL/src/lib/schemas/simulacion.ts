import { z } from "zod";

export const CASO_MAXIMO = 200;
export const TEXTO_MIN_LEN = 20;
export const TEXTO_MAX_LEN = 5000;
export const IDENTIFICADOR_MIN_LEN = 3;
export const IDENTIFICADOR_MAX_LEN = 100;

export const casoSimulacionSchema = z.object({
    texto: z.string().min(TEXTO_MIN_LEN, "El texto debe tener al menos 20 caracteres").max(TEXTO_MAX_LEN, "El texto no puede exceder 5000 caracteres"),
    plataforma: z.string().min(1, "La plataforma es requerida"),
    identificador: z.string().min(IDENTIFICADOR_MIN_LEN, "El identificador debe tener al menos 3 caracteres").max(IDENTIFICADOR_MAX_LEN, "El identificador no puede exceder 100 caracteres"),
    categoriaEsperada: z.string().max(100).optional(),
});

export type CasoSimulacion = z.infer<typeof casoSimulacionSchema>;

export const crearSimulacionSchema = z.object({
    modelo: z.string().min(1, "El modelo es requerido"),
    archivo: z.string().min(1, "El archivo es requerido"),
    formato: z.enum(["csv", "json"]),
});

export type CrearSimulacionInput = z.infer<typeof crearSimulacionSchema>;
