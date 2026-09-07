import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { POST as loginPOST } from "../../auth/login/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { enviarEmailBienvenidaComite } from "@/lib/email";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarEmailBienvenidaOperador: vi.fn().mockResolvedValue(undefined),
    enviarEmailBienvenidaComite: vi.fn().mockResolvedValue(undefined),
}));

describe("/api/admin/operadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea un miembro del comité con esComite=true", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "comite@test.com",
                    nombre: "Miembro Comité",
                    rol: "COMITE_VALIDACION",
                }),
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.operador.rol).toBe("COMITE_VALIDACION");
        expect(json.operador.perfil.esComite).toBe(true);

        const usuario = await prisma.usuario.findUnique({
            where: { id: json.operador.id },
            include: { perfilOperador: true },
        });
        expect(usuario?.perfilOperador?.esComite).toBe(true);
    });

    // SPEC-579 (bug real 2026-09-07): operador creado como «Jelkin…» no podía
    // iniciar sesión — el login busca en minúsculas (loginSchema) y la creación
    // administrativa guardaba el email tal cual. La normalización vive en el
    // repositorio (punto único de escritura/lectura por email).
    it("SPEC-579: operador creado con email en mayúsculas queda en minúsculas y puede iniciar sesión", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "Operador.Mayusculas@Test.COM",
                    nombre: "Operador Mayus",
                    rol: "OPERADOR",
                }),
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.operador.email).toBe("operador.mayusculas@test.com");

        const enBd = await prisma.usuario.findUnique({ where: { id: json.operador.id } });
        expect(enBd?.email).toBe("operador.mayusculas@test.com");

        // Duplicado con otro casing: lo detecta como duplicado (no 500 del unique).
        const dup = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "OPERADOR.MAYUSCULAS@test.com",
                    nombre: "Operador Duplicado",
                    rol: "OPERADOR",
                }),
            })
        );
        expect(dup.status).toBe(409);

        // Login digitando el email en mayúsculas (como hace el usuario real).
        const loginRes = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "Operador.Mayusculas@Test.COM",
                    password: json.passwordTemporal,
                }),
            })
        );
        expect(loginRes.status).toBe(200);
    }, 30_000);

    it("rechaza crear OPERADOR con esComite=true", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "op@test.com",
                    nombre: "Operador",
                    rol: "OPERADOR",
                    esComite: true,
                }),
            })
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("EXCLUSIVIDAD_ROL");
    });

    it("lista operadores y miembros del comité", async () => {
        const admin = await crearUsuario("ADMIN");
        const op = await crearUsuario("OPERADOR", "op@test.com");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@test.com");
        await prisma.perfilOperador.createMany({
            data: [
                { usuarioId: op.id, creadoPorId: admin.id, cupoMaximo: 10, esComite: false },
                { usuarioId: comite.id, creadoPorId: admin.id, cupoMaximo: 10, esComite: true },
            ],
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/operadores", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.operadores).toHaveLength(2);
        expect(json.operadores.map((o: { rol: string }) => o.rol).sort()).toEqual(["COMITE_VALIDACION", "OPERADOR"]);
    });

    it("usa AuditLog COMITE_CREADO y envía email de bienvenida al crear COMITE_VALIDACION", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "comite@test.com",
                    nombre: "Miembro Comité",
                    rol: "COMITE_VALIDACION",
                }),
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.operador.rol).toBe("COMITE_VALIDACION");
        expect(json.mensaje.toLowerCase()).toContain("comité de validación");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_CREADO", recursoId: json.operador.id },
        });
        expect(audit).not.toBeNull();
        expect(enviarEmailBienvenidaComite).toHaveBeenCalledWith("comite@test.com", expect.any(String));
    });

    it("devuelve 409 al crear COMITE_VALIDACION con email de OPERADOR existente", async () => {
        const admin = await crearUsuario("ADMIN");
        await crearUsuario("OPERADOR", "op@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "op@test.com",
                    nombre: "Comité Conflicto",
                    rol: "COMITE_VALIDACION",
                }),
            })
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toContain("comité de validación");
        expect(json.error.message).toContain("operador");
    });

    it("devuelve 409 al crear OPERADOR con email de COMITE_VALIDACION existente", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite-conflicto@test.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({
                    email: "comite-conflicto@test.com",
                    nombre: "Operador Conflicto",
                    rol: "OPERADOR",
                }),
            })
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toContain("operador");
        expect(json.error.message).toContain("comité de validación");
    });
});
