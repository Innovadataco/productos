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

function llamar(padreId: string) {
    return POST(
        new Request(`http://localhost:5005/api/admin/padres/${padreId}/reactivar`, {
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

describe("POST /api/admin/padres/[id]/reactivar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("reactiva la cuenta, audita y el login vuelve a funcionar", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre@example.com", "TestPass123");
        await prisma.usuario.update({ where: { id: padre.id }, data: { estado: "inactivo" } });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(padre.id);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.padre.estado).toBe("activo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "USER_UPDATE", tipoRecurso: "Usuario", recursoId: padre.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorNuevo).toContain("activo");

        expect((await login("padre@example.com", "TestPass123")).status).toBe(200);
    });

    it("es idempotente sobre una cuenta ya activa (sin duplicar auditoría)", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(padre.id);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.padre.estado).toBe("activo");

        const auditorias = await prisma.auditLog.count({
            where: { tipoRecurso: "Usuario", recursoId: padre.id },
        });
        expect(auditorias).toBe(0);
    });

    it("devuelve 404 si el id no corresponde a un PARENT", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar(operador.id);
        expect(res.status).toBe(404);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await llamar(padre.id);
        expect(res.status).toBe(403);
    });
});
