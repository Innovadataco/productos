/**
 * SPEC-435 · Zod schemas para el panel admin de cuentas VERIFICADOR.
 * Aparte de `./index.ts` para no cruzar el techo de 500 líneas del índice.
 */
import { z } from "zod";
import { cuidIdSchema } from "./base";

export const verificadorIdParamsSchema = z.object({
    id: cuidIdSchema,
});

export const verificadorEstadoBodySchema = z.object({
    estado: z.enum(["activo", "inactivo"]),
});
