/**
 * SPEC-401 (I-283) · unit tests del helper motivo-error.
 *
 * Cubre:
 *  - `sanitizarPII`: emails, tokens con prefijo (re_, sk_, pk_, whsec_), Bearer.
 *  - `resumirErrorProveedor`: forma Resend, Error nativo, string, undefined, objeto plano con .code.
 *  - `serializarMotivoParaPersistencia`: brackets, statusCode, código, preserva "429"/"quota"/"rate limit" para el regex de `senalCorreosFallidos`.
 *  - `EmailProveedorError`: expone `.resumen` y hereda `.message` serializado.
 */
import { describe, it, expect } from "vitest";
import {
    EmailProveedorError,
    resumirErrorProveedor,
    sanitizarPII,
    serializarMotivoParaPersistencia,
} from "./motivo-error";

// El regex vive en `inicio-admin.ts` como constante privada — lo replicamos
// para afirmar backward-compat sin importar cross-módulo.
const PATRON_CUOTA_ESPEJO = /(quota|rate\s*limit|429|too\s*many\s*requests)/i;

describe("sanitizarPII", () => {
    it("reemplaza emails con <email:HHHHHHHH> determinístico (mismo email → mismo hash)", () => {
        const a = sanitizarPII("Recipient jelkin@innovadataco.com is bounced");
        const b = sanitizarPII("Recipient JELKIN@innovadataco.com is bounced");
        expect(a).toMatch(/^Recipient <email:[0-9a-f]{8}> is bounced$/);
        // case-insensitive: mismo hash para el mismo destinatario.
        expect(a).toEqual(b);
    });

    it("emails distintos → hashes distintos", () => {
        const a = sanitizarPII("a@x.com");
        const b = sanitizarPII("b@x.com");
        expect(a).not.toEqual(b);
    });

    it("redacta tokens re_/sk_/pk_/whsec_ conservando el prefijo", () => {
        expect(sanitizarPII("Bad key re_abcdef1234")).toBe("Bad key <token:re>");
        expect(sanitizarPII("secret sk_test_ABCDEFGH")).toBe("secret <token:sk>");
        expect(sanitizarPII("public pk_live_1234ABCD")).toBe("public <token:pk>");
        expect(sanitizarPII("wh whsec_XYZ98765")).toBe("wh <token:whsec>");
    });

    it("redacta 'Bearer <token>' completo", () => {
        expect(sanitizarPII("Authorization: Bearer abc12345.def")).toBe("Authorization: <token:bearer>");
        expect(sanitizarPII("bearer ABCDEFGH")).toBe("<token:bearer>");
    });

    it("no toca texto ordinario ni palabras que no coincidan con los patrones", () => {
        expect(sanitizarPII("You exceeded the rate limit — try again in 60s")).toBe(
            "You exceeded the rate limit — try again in 60s"
        );
    });

    it("string vacío pasa tal cual", () => {
        expect(sanitizarPII("")).toBe("");
    });
});

describe("resumirErrorProveedor", () => {
    it("acepta la forma del SDK de Resend {name, message, statusCode}", () => {
        const err = { name: "rate_limit_exceeded", message: "You exceeded the rate limit", statusCode: 429 };
        const r = resumirErrorProveedor(err);
        expect(r.name).toBe("rate_limit_exceeded");
        expect(r.message).toBe("You exceeded the rate limit");
        expect(r.statusCode).toBe(429);
        expect(r.codigo).toBeUndefined();
    });

    it("acepta Error nativo", () => {
        const err = new Error("boom!");
        err.name = "TypeError";
        const r = resumirErrorProveedor(err);
        expect(r.name).toBe("TypeError");
        expect(r.message).toBe("boom!");
        expect(r.statusCode).toBeUndefined();
    });

    it("acepta string plano — name = 'Error'", () => {
        expect(resumirErrorProveedor("oops")).toEqual({ name: "Error", message: "oops" });
    });

    it("null/undefined → 'UnknownError' + mensaje por defecto", () => {
        expect(resumirErrorProveedor(null)).toEqual({ name: "UnknownError", message: "sin detalle del proveedor" });
        expect(resumirErrorProveedor(undefined)).toEqual({ name: "UnknownError", message: "sin detalle del proveedor" });
    });

    it("objeto plano con .code — lo mueve a `codigo`", () => {
        const r = resumirErrorProveedor({ name: "ETIMEDOUT", message: "timeout", code: "ETIMEDOUT" });
        expect(r.codigo).toBe("ETIMEDOUT");
    });

    it("sanitiza PII del mensaje (email del destinatario)", () => {
        const r = resumirErrorProveedor({
            name: "hard_bounce",
            message: "Recipient joe@example.com is on the suppression list",
            statusCode: 422,
        });
        expect(r.message).toMatch(/^Recipient <email:[0-9a-f]{8}> is on the suppression list$/);
    });

    it("recorta mensajes ridículamente largos a 500 chars con ...", () => {
        const largo = "x".repeat(2000);
        const r = resumirErrorProveedor({ name: "X", message: largo });
        expect(r.message.length).toBe(500);
        expect(r.message.endsWith("...")).toBe(true);
    });

    it("desinfecta corchetes/CR/LF/TAB en el name para no romper el formato", () => {
        const r = resumirErrorProveedor({ name: "bad]name\n[injected", message: "x" });
        expect(r.name).not.toMatch(/[\[\]\n\r\t]/);
    });

    it("statusCode no numérico → undefined (no rompe)", () => {
        const r = resumirErrorProveedor({ name: "X", message: "x", statusCode: "429" });
        expect(r.statusCode).toBeUndefined();
    });
});

describe("serializarMotivoParaPersistencia", () => {
    it("formato canónico con statusCode: [name][code] mensaje", () => {
        const s = serializarMotivoParaPersistencia({
            name: "rate_limit_exceeded",
            message: "You exceeded the rate limit",
            statusCode: 429,
        });
        expect(s).toBe("[rate_limit_exceeded][429] You exceeded the rate limit");
    });

    it("sin statusCode: solo el name", () => {
        const s = serializarMotivoParaPersistencia({ name: "TypeError", message: "boom" });
        expect(s).toBe("[TypeError] boom");
    });

    it("con codigo: bracket cod:", () => {
        const s = serializarMotivoParaPersistencia({ name: "X", message: "y", codigo: "ETIMEDOUT" });
        expect(s).toBe("[X][cod:ETIMEDOUT] y");
    });

    it("PRESERVA palabras del regex PATRON_CUOTA (backward-compat de senalCorreosFallidos)", () => {
        expect(PATRON_CUOTA_ESPEJO.test(
            serializarMotivoParaPersistencia({ name: "rate_limit_exceeded", message: "You exceeded the rate limit", statusCode: 429 })
        )).toBe(true);
        expect(PATRON_CUOTA_ESPEJO.test(
            serializarMotivoParaPersistencia({ name: "quota_exceeded", message: "Provider quota exceeded", statusCode: 402 })
        )).toBe(true);
        expect(PATRON_CUOTA_ESPEJO.test(
            serializarMotivoParaPersistencia({ name: "too_many_requests", message: "slow down", statusCode: 429 })
        )).toBe(true);
    });
});

describe("EmailProveedorError", () => {
    it("expone .resumen y hereda .message serializado", () => {
        const err = new EmailProveedorError({
            name: "rate_limit_exceeded",
            message: "You exceeded the rate limit",
            statusCode: 429,
        });
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("EmailProveedorError");
        expect(err.resumen.statusCode).toBe(429);
        expect(err.message).toBe("[rate_limit_exceeded][429] You exceeded the rate limit");
    });
});
