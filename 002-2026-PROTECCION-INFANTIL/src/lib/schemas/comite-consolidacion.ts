// SPEC-237 (002-PI-mega-cola): bandeja comité CONSOLIDACION + aprobación multi-miembro.
// Separado de index.ts por la regla max-lines (500) del lint.
// OJO: no importar de ./index (ciclo ESM: index re-exporta este archivo y los
// imports izados dejan cuidIdSchema en TDZ). cuid inline, mismo contrato.
import { z } from "zod";

export const bandejaConsolidacionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const aprobarInformeBodySchema = z.object({}).strict();

export const corregirInformeBodySchema = z.object({
    resumenTextoGenerado: z.string().min(1, "El resumen no puede estar vacío").max(20000),
    motivo: z.string().min(1, "El motivo es obligatorio").max(500),
    guiaAccionCategoriaIdPrincipal: z.string().cuid().optional(),
});

export const devolverInformeBodySchema = z.object({
    motivo: z.string().min(1, "El motivo es obligatorio").max(1000),
});
