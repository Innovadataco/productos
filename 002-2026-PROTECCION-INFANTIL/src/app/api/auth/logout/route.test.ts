/**
 * Spec 106 (I-32): el borrado de la cookie de sesión debe emitirse con los MISMOS
 * atributos con que se creó. Un Set-Cookie de borrado sin `Secure` + `Path=/` es
 * rechazado por el navegador (prefijo __Host-) y la sesión sobrevive con un 200.
 * Estos tests verifican los atributos del borrado (equivalente a la cabecera Set-Cookie),
 * NO el status: el servidor siempre respondió 200 con el bug activo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

interface CookieEscrita {
    name: string;
    value: string;
    opciones: Record<string, unknown>;
}

let escritas: CookieEscrita[];

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
        set: (name: string, value: string, opciones: Record<string, unknown>) => {
            escritas.push({ name, value, opciones });
        },
        delete: (name: string) => {
            escritas.push({ name, value: "", opciones: { __viaDelete: true } });
        },
    }),
}));

describe("POST /api/auth/logout — borrado simétrico de la cookie (I-32)", () => {
    beforeEach(() => {
        escritas = [];
    });

    it("borra __Host-token con Secure, HttpOnly, Path=/, SameSite=strict y expiración pasada", async () => {
        const res = await POST();
        expect(res.status).toBe(200);

        const hostToken = escritas.find((c) => c.name === "__Host-token");
        expect(hostToken, "debe emitirse el borrado de __Host-token").toBeDefined();
        expect(hostToken!.opciones.__viaDelete, "no vale delete() a secas").toBeUndefined();
        expect(hostToken!.opciones.secure).toBe(true);
        expect(hostToken!.opciones.httpOnly).toBe(true);
        expect(hostToken!.opciones.sameSite).toBe("strict");
        expect(hostToken!.opciones.path).toBe("/");
        expect(hostToken!.opciones.maxAge, "expiración en el pasado").toBe(0);
    });

    it("borra la legacy token con los atributos de su esquema (sin Secure) y expiración pasada", async () => {
        await POST();

        const legacy = escritas.find((c) => c.name === "token");
        expect(legacy, "debe emitirse el borrado de la legacy token").toBeDefined();
        expect(legacy!.opciones.secure).toBe(false);
        expect(legacy!.opciones.httpOnly).toBe(true);
        expect(legacy!.opciones.sameSite).toBe("lax");
        expect(legacy!.opciones.path).toBe("/");
        expect(legacy!.opciones.maxAge).toBe(0);
    });

    it("corrección ZEUS: con x-forwarded-proto AUSENTE, __Host-token sigue borrándose con Secure y Path=/", async () => {
        // El bug original solo era visible en prod: si la detección de esquema devuelve
        // false (sin cabecera), el borrado salía sin Secure y el navegador lo rechazaba.
        const reqSinProto = new Request("http://localhost/api/auth/logout", { method: "POST" });
        expect(reqSinProto.headers.get("x-forwarded-proto")).toBeNull();

        await POST();

        const hostToken = escritas.find((c) => c.name === "__Host-token");
        expect(hostToken!.opciones.secure).toBe(true);
        expect(hostToken!.opciones.path).toBe("/");
    });
});
