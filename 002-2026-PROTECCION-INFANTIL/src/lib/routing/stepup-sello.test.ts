/**
 * SPEC-598 — código de email con propósito «Crear contraseña».
 *
 * SPEC-606: el step-up del texto sensible dejó de usar este token firmado
 * (ahora es un código de 6 dígitos con estado en BD, ver `stepup-codigo.ts`);
 * este formato queda EXCLUSIVO de «Crear contraseña». Sin BD.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
    firmarCodigoCrearPassword,
    leerCodigoCrearPassword,
    VIGENCIA_CODIGO_STEPUP_EMAIL_MIN,
} from "./stepup-sello";

const SECRET = "test-secret-stepup-de-32-caracteres!!";

beforeAll(() => {
    process.env.JWT_SECRET ??= SECRET;
});

describe("código de email para «Crear contraseña» (SPEC-598)", () => {
    it("el código de crear contraseña verifica contra su propio propósito", () => {
        const codigo = firmarCodigoCrearPassword("user-1", SECRET);
        expect(leerCodigoCrearPassword(codigo, "user-1", SECRET)).not.toBeNull();
    });

    it("no es transferible: el código de otro usuario no verifica", () => {
        const codigo = firmarCodigoCrearPassword("user-1", SECRET);
        expect(leerCodigoCrearPassword(codigo, "user-2", SECRET)).toBeNull();
    });

    it("firma alterada no verifica", () => {
        const codigo = firmarCodigoCrearPassword("user-1", SECRET);
        const [datos, firma] = codigo.split(".");
        // Dos códigos del mismo usuario en el mismo segundo comparten payload
        // (misma firma); la mutación va sobre el payload, no sobre la firma.
        const corrupto = datos.startsWith("A") ? `B${datos.slice(1)}` : `A${datos.slice(1)}`;
        expect(leerCodigoCrearPassword(`${corrupto}.${firma}`, "user-1", SECRET)).toBeNull();
    });

    it("rechaza secret corto o ausente al firmar", () => {
        expect(() => firmarCodigoCrearPassword("user-1", "corto")).toThrow();
        expect(() => firmarCodigoCrearPassword("user-1", "")).toThrow();
    });

    it("mantiene la vigencia canónica de 10 minutos", () => {
        expect(VIGENCIA_CODIGO_STEPUP_EMAIL_MIN).toBe(10);
    });
});
