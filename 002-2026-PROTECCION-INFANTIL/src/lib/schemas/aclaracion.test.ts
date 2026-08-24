/**
 * SPEC-238 (002-PI-mega-cola): tests unitarios de los schemas Zod de la
 * aclaración padre-comité (sin BD). FR-010.
 */
import { describe, it, expect } from "vitest";
import {
    estadoAclaracionExpedienteSchema,
    pedirAclaracionBodySchema,
    responderAclaracionBodySchema,
} from "./aclaracion";

describe("schemas de aclaración padre-comité (SPEC-238)", () => {
    it("estadoAclaracionExpedienteSchema acepta los tres estados del brief", () => {
        for (const estado of ["PENDIENTE", "RESPONDIDA", "CERRADA_FORZOSAMENTE"]) {
            expect(estadoAclaracionExpedienteSchema.parse(estado)).toBe(estado);
        }
        expect(estadoAclaracionExpedienteSchema.safeParse("OTRO").success).toBe(false);
    });

    it("pedirAclaracionBodySchema acepta un texto válido y lo recorta", () => {
        const parsed = pedirAclaracionBodySchema.parse({ solicitudTexto: "  ¿Por qué dos ciudades?  " });
        expect(parsed.solicitudTexto).toBe("¿Por qué dos ciudades?");
    });

    it("pedirAclaracionBodySchema rechaza vacío y más de 2000 caracteres", () => {
        expect(pedirAclaracionBodySchema.safeParse({ solicitudTexto: "" }).success).toBe(false);
        expect(pedirAclaracionBodySchema.safeParse({ solicitudTexto: "   " }).success).toBe(false);
        expect(pedirAclaracionBodySchema.safeParse({ solicitudTexto: "x".repeat(2001) }).success).toBe(false);
        expect(pedirAclaracionBodySchema.safeParse({ solicitudTexto: "x".repeat(2000) }).success).toBe(true);
    });

    it("responderAclaracionBodySchema aplica las mismas reglas de texto", () => {
        expect(responderAclaracionBodySchema.safeParse({ respuestaTexto: "" }).success).toBe(false);
        expect(responderAclaracionBodySchema.safeParse({ respuestaTexto: "x".repeat(2001) }).success).toBe(false);
        expect(responderAclaracionBodySchema.parse({ respuestaTexto: "Respuesta" }).respuestaTexto).toBe("Respuesta");
    });
});
