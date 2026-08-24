/**
 * SPEC-226 (002-PI-mega-cola, FR-016): tests unitarios de los esquemas Zod de
 * `accionParametros` por tipo de acción (sin BD).
 */
import { describe, it, expect } from "vitest";
import {
    crearBonoSchema,
    enviarNotificacionSchema,
    asignarOperadorSchema,
    crearAlertaSchema,
} from "./schemas";

describe("crearBonoSchema", () => {
    it("acepta parámetros válidos", () => {
        const r = crearBonoSchema.safeParse({ tipoBono: "DESCUENTO_PCT", valor: 20, vigenciaDias: 15 });
        expect(r.success).toBe(true);
    });

    it("rechaza valor <= 0", () => {
        expect(crearBonoSchema.safeParse({ tipoBono: "DESCUENTO_PCT", valor: 0, vigenciaDias: 15 }).success).toBe(false);
        expect(crearBonoSchema.safeParse({ tipoBono: "DESCUENTO_PCT", valor: -5, vigenciaDias: 15 }).success).toBe(false);
    });

    it("rechaza tipoBono fuera del enum", () => {
        expect(crearBonoSchema.safeParse({ tipoBono: "GRATIS_TOTAL", valor: 20, vigenciaDias: 15 }).success).toBe(false);
    });

    it("rechaza vigenciaDias fuera de 1..365 o no entero", () => {
        expect(crearBonoSchema.safeParse({ tipoBono: "MESES_GRATIS", valor: 1, vigenciaDias: 0 }).success).toBe(false);
        expect(crearBonoSchema.safeParse({ tipoBono: "MESES_GRATIS", valor: 1, vigenciaDias: 366 }).success).toBe(false);
        expect(crearBonoSchema.safeParse({ tipoBono: "MESES_GRATIS", valor: 1, vigenciaDias: 1.5 }).success).toBe(false);
    });
});

describe("enviarNotificacionSchema", () => {
    it("acepta evento con variables opcionales", () => {
        expect(enviarNotificacionSchema.safeParse({ evento: "pagos.recordatorio" }).success).toBe(true);
        expect(
            enviarNotificacionSchema.safeParse({ evento: "pagos.recordatorio", variables: { cliente: "X" } }).success
        ).toBe(true);
    });

    it("rechaza evento vacío", () => {
        expect(enviarNotificacionSchema.safeParse({ evento: "" }).success).toBe(false);
    });
});

describe("asignarOperadorSchema", () => {
    it("acepta operadorId explícito o estrategia menor_carga, pero no ambos ni ninguno", () => {
        expect(asignarOperadorSchema.safeParse({ operadorId: "op-1" }).success).toBe(true);
        expect(asignarOperadorSchema.safeParse({ estrategia: "menor_carga" }).success).toBe(true);
        expect(asignarOperadorSchema.safeParse({}).success).toBe(false);
        expect(asignarOperadorSchema.safeParse({ operadorId: "op-1", estrategia: "menor_carga" }).success).toBe(false);
    });
});

describe("crearAlertaSchema", () => {
    it("acepta severidad válida y mensaje", () => {
        expect(crearAlertaSchema.safeParse({ severidad: "ALTA", mensaje: "Prueba" }).success).toBe(true);
    });

    it("rechaza severidad inválida o mensaje vacío", () => {
        expect(crearAlertaSchema.safeParse({ severidad: "CRITICA", mensaje: "Prueba" }).success).toBe(false);
        expect(crearAlertaSchema.safeParse({ severidad: "BAJA", mensaje: "" }).success).toBe(false);
    });
});
