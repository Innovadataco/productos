import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { POST as POSTLogin } from "@/app/api/auth/login/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

// Evita llamadas HTTP reales a Resend en CI; el endpoint maneja el fallo y expone
// la contraseña temporal exactamente una vez (I-37 / 002-PI-051 B3).
vi.mock("resend", () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: vi.fn().mockResolvedValue({ error: { message: "mock email failure" } }),
        },
    })),
}));

function llamar(padreId: string) {
    return POST(
        new Request(`http://localhost:5005/api/admin/padres/${padreId}/restablecer-password`, {
            method: "POST",
            headers: mockToken ? { cookie: `token=${mockToken}` } : {},
        }),
        { params: Promise.resolve({ id: padreId }) }
    );
}

function login(email: string, password: string) {
    return POSTLogin(
        new Request("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        })
    );
}

describe("POST /api/admin/padres/[id]/restablecer-password", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("restablece: cambia el hash, fuerza debeCambiarPassword, audita y la temporal permite entrar", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre@example.com", "ClaveVieja123");
        const hashAntes = padre.passwordHash;
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(padre.id);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(typeof json.passwordTemporal).toBe("string");
        expect(json.passwordTemporal.length).toBeGreaterThanOrEqual(8);
        expect(json.padre).toMatchObject({ id: padre.id, email: "padre@example.com", debeCambiarPassword: true });

        const actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(actualizado?.passwordHash).not.toBe(hashAntes);
        expect(actualizado?.debeCambiarPassword).toBe(true);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "USER_UPDATE", tipoRecurso: "Usuario", recursoId: padre.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        // La contraseña temporal nunca queda en auditoría
        expect(JSON.stringify(audit)).not.toContain(json.passwordTemporal);

        // La contraseña vieja ya no sirve; la temporal sí
        expect((await login("padre@example.com", "ClaveVieja123")).status).toBe(401);
        expect((await login("padre@example.com", json.passwordTemporal)).status).toBe(200);
    });

    it("devuelve 404 si el id no corresponde a un PARENT", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(operador.id);
        expect(res.status).toBe(404);
    });

    it("devuelve 400 si el id no es un cuid válido", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar("no-es-cuid");
        expect(res.status).toBe(400);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await llamar(padre.id);
        expect(res.status).toBe(403);
    });
});
