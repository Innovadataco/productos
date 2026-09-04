/**
 * SPEC-435 · Rutas de gestión de VERIFICADOR.
 *
 * Cubre el contrato de crear + listar + guardia por rol:
 *   · POST crea la cuenta y DEVUELVE `passwordTemporal` SIEMPRE (contrato
 *     Jelkin, 04-09) — el candado permanente
 *     `credencial-siempre-visible.candado.test.ts` protege el flujo de
 *     restablecer/reenviar; este test refuerza el ALTA.
 *   · GET lista solo cuentas con rol VERIFICADOR.
 *   · Un VERIFICADOR NO puede llamar `/api/admin/verificadores` (403 por
 *     `verifyAuth("ADMIN")`).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarEmailBienvenidaOperador: vi.fn().mockResolvedValue(undefined),
    enviarEmailBienvenidaComite: vi.fn().mockResolvedValue(undefined),
    enviarEmailCambioPassword: vi.fn().mockResolvedValue(undefined),
}));

describe("/api/admin/verificadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea una cuenta VERIFICADOR y devuelve la contraseña temporal en la respuesta", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/verificadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({ email: "verif@test.com", nombre: "Verif Test" }),
            }),
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.verificador.email).toBe("verif@test.com");
        // SPEC-435 · contrato Jelkin: passwordTemporal SIEMPRE viaja en el alta.
        expect(json.passwordTemporal).toEqual(expect.stringMatching(/^[0-9a-f]{12}$/));

        const usuario = await prisma.usuario.findUnique({ where: { email: "verif@test.com" } });
        expect(usuario?.rol).toBe("VERIFICADOR");
        expect(usuario?.debeCambiarPassword).toBe(true);
    });

    it("rechaza email duplicado con 409", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearUsuario("VERIFICADOR", "duplicado@test.com");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/verificadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({ email: "duplicado@test.com", nombre: "Verif Dup" }),
            }),
        );

        expect(res.status).toBe(409);
    });

    it("GET lista solo cuentas con rol VERIFICADOR", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearUsuario("VERIFICADOR", "v1@test.com");
        await crearUsuario("VERIFICADOR", "v2@test.com");
        await crearUsuario("OPERADOR", "op1@test.com"); // no debe aparecer

        const res = await GET(
            new Request("http://localhost:5005/api/admin/verificadores", {
                method: "GET",
                headers: { cookie: `token=${mockToken}` },
            }),
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        const emails = (json.verificadores as { email: string }[]).map((v) => v.email);
        expect(emails).toContain("v1@test.com");
        expect(emails).toContain("v2@test.com");
        expect(emails).not.toContain("op1@test.com");
    });

    it("un VERIFICADOR NO puede llamar /api/admin/verificadores (verifyAuth exige ADMIN)", async () => {
        const verif = await crearUsuario("VERIFICADOR");
        mockToken = await crearTokenUsuario(verif.id, "VERIFICADOR");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/verificadores", {
                method: "GET",
                headers: { cookie: `token=${mockToken}` },
            }),
        );

        expect(res.status).toBe(403);
    });
});
