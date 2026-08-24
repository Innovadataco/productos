/**
 * SPEC-239 (002-PI-mega-cola): tests unitarios de los schemas Zod de contactos
 * de emergencia (T013): validación E.164, prioridad 1..3 y update parcial.
 */
import { describe, it, expect } from "vitest";
import {
    telefonoE164Schema,
    contactoEmergenciaBodySchema,
    contactoEmergenciaUpdateSchema,
    contactoEmergenciaQuerySchema,
} from "./contacto-emergencia";

describe("telefonoE164Schema (SPEC-239)", () => {
    it("acepta formato E.164 válido", () => {
        expect(telefonoE164Schema.safeParse("+573001234567").success).toBe(true);
        expect(telefonoE164Schema.safeParse("+14155552671").success).toBe(true);
    });

    it("rechaza teléfonos sin +, con letras o demasiado cortos/largos", () => {
        expect(telefonoE164Schema.safeParse("3001234567").success).toBe(false);
        expect(telefonoE164Schema.safeParse("+57 300 123 4567").success).toBe(false);
        expect(telefonoE164Schema.safeParse("+57abc").success).toBe(false);
        expect(telefonoE164Schema.safeParse("+0123").success).toBe(false);
        expect(telefonoE164Schema.safeParse("+1").success).toBe(false);
        expect(telefonoE164Schema.safeParse("+12345678901234567").success).toBe(false);
    });
});

describe("contactoEmergenciaBodySchema (SPEC-239)", () => {
    const valido = {
        nombre: "María García",
        relacion: "MADRE",
        telefono: "+573001234567",
        email: "maria@example.com",
        prioridad: 1,
    };

    it("acepta un contacto válido completo", () => {
        expect(contactoEmergenciaBodySchema.safeParse(valido).success).toBe(true);
    });

    it("acepta contacto sin email (opcional)", () => {
        const { email: _omitido, ...sinEmail } = valido;
        expect(contactoEmergenciaBodySchema.safeParse(sinEmail).success).toBe(true);
    });

    it("rechaza teléfono inválido antes de tocar la BD (US1.6)", () => {
        expect(contactoEmergenciaBodySchema.safeParse({ ...valido, telefono: "3001234567" }).success).toBe(false);
    });

    it("rechaza prioridad fuera de 1..3 y relación fuera del enum", () => {
        expect(contactoEmergenciaBodySchema.safeParse({ ...valido, prioridad: 0 }).success).toBe(false);
        expect(contactoEmergenciaBodySchema.safeParse({ ...valido, prioridad: 4 }).success).toBe(false);
        expect(contactoEmergenciaBodySchema.safeParse({ ...valido, relacion: "AMIGO" }).success).toBe(false);
    });
});

describe("contactoEmergenciaUpdateSchema (SPEC-239)", () => {
    it("permite actualización parcial y el flag activo", () => {
        expect(contactoEmergenciaUpdateSchema.safeParse({ prioridad: 2 }).success).toBe(true);
        expect(contactoEmergenciaUpdateSchema.safeParse({ activo: false }).success).toBe(true);
        expect(contactoEmergenciaUpdateSchema.safeParse({}).success).toBe(true);
    });

    it("sigue validando E.164 en actualización", () => {
        expect(contactoEmergenciaUpdateSchema.safeParse({ telefono: "123" }).success).toBe(false);
    });
});

describe("contactoEmergenciaQuerySchema (SPEC-239)", () => {
    it("aplica defaults de paginación y solo activos", () => {
        const parsed = contactoEmergenciaQuerySchema.parse({});
        expect(parsed).toEqual({ page: 1, pageSize: 25, incluirInactivos: false });
    });

    it("transforma incluirInactivos a booleano", () => {
        expect(contactoEmergenciaQuerySchema.parse({ incluirInactivos: "true" }).incluirInactivos).toBe(true);
    });
});
