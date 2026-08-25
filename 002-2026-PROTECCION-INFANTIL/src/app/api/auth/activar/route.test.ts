import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
        set: vi.fn(),
    }),
}));

function makeRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/auth/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function crearRectorInvitado(email: string) {
    const admin = await crearUsuario("ADMIN");
    const resultado = await new RegistroColegioService().preRegistrarPorAdmin(
        "Colegio Activar",
        "Rector Activar",
        email,
        admin.id
    );
    if (!resultado.ok) throw new Error("No se pudo crear rector invitado");
    return resultado.token;
}

describe("POST /api/auth/activar", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("rechaza 400 sin token ni password", async () => {
        const res = await POST(makeRequest({}));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza token inválido o ya usado", async () => {
        const res = await POST(makeRequest({ token: "token-falso", password: "Clave1234" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toContain("no es válido o ya fue usado");
    });

    it("activa cuenta invitada con token válido (SPEC-240)", async () => {
        const email = "activar-ok@example.com";
        const token = await crearRectorInvitado(email);

        const res = await POST(makeRequest({ token, password: "Clave1234" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.user.email).toBe(email);
        expect(data.user.rol).toBe("SCHOOL_ADMIN");

        const user = await prisma.usuario.findUnique({ where: { email } });
        expect(user?.estadoActivacion).toBe("REGISTRADO");
        expect(user?.tokenInvitacion).toBeNull();
        expect(user?.tokenInvitacionExpiraEn).toBeNull();
    });

    it("rechaza password débil", async () => {
        const email = "activar-debil@example.com";
        const token = await crearRectorInvitado(email);

        const res = await POST(makeRequest({ token, password: "corta" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toContain("Contraseña");
    });

    it("rechaza reutilizar token consumido", async () => {
        const email = "activar-reuso@example.com";
        const token = await crearRectorInvitado(email);

        const primera = await POST(makeRequest({ token, password: "Clave1234" }));
        expect(primera.status).toBe(200);

        const segunda = await POST(makeRequest({ token, password: "Clave1234" }));
        expect(segunda.status).toBe(400);
        const data = await segunda.json();
        expect(data.error.message).toContain("no es válido o ya fue usado");
    });
});
