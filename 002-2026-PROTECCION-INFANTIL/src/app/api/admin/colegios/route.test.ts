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

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn().mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0 }),
}));

function bodyNuevoColegio() {
    return {
        nombreColegio: "Colegio Test",
        nombreRector: "Rector Test",
        emailRector: `rector-${Date.now()}@test.com`,
    };
}

function postRequest(token: string, body: unknown): Request {
    return new Request("http://localhost:5005/api/admin/colegios", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${token}` },
        body: JSON.stringify(body),
    });
}

describe("/api/admin/colegios", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("pre-registra un colegio con 3 campos y crea rector INVITADO (SPEC-240)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const body = bodyNuevoColegio();
        const res = await POST(postRequest(mockToken, body));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.colegio.nombre).toBe(body.nombreColegio);
        expect(json.colegio.estado).toBe("activo");
        expect(json.admin.email).toBe(body.emailRector.toLowerCase());
        expect(json.admin.estadoActivacion).toBe("INVITADO");
        expect(json.passwordTemporal).toBeUndefined();
        expect(json.mensaje).toContain("Invitación enviada");

        const schoolAdmin = await prisma.usuario.findUnique({
            where: { email: body.emailRector.toLowerCase() },
            include: { colegio: true },
        });
        expect(schoolAdmin).not.toBeNull();
        expect(schoolAdmin?.rol).toBe("SCHOOL_ADMIN");
        expect(schoolAdmin?.estadoActivacion).toBe("INVITADO");
        expect(schoolAdmin?.tokenInvitacion).not.toBeNull();
        expect(schoolAdmin?.colegioId).toBe(json.colegio.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CREADO", recursoId: json.colegio.id },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza SCHOOL_ADMIN intentando crear colegio", async () => {
        const schoolAdmin = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(schoolAdmin.id, "SCHOOL_ADMIN");

        const res = await POST(postRequest(mockToken, bodyNuevoColegio()));
        expect(res.status).toBe(403);
    });

    it("rechaza crear colegio si el email del rector ya existe", async () => {
        const admin = await crearUsuario("ADMIN");
        const existing = await crearUsuario("PARENT", "duplicado@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const body = bodyNuevoColegio();
        body.emailRector = existing.email;

        const res = await POST(postRequest(mockToken, body));
        expect(res.status).toBe(409);
    });

    it("rechaza body inválido (faltan campos)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(postRequest(mockToken, { nombreColegio: "X" }));
        expect(res.status).toBe(400);
    });

    it("lista colegios creados", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        await POST(postRequest(mockToken, bodyNuevoColegio()));

        const res = await GET(
            new Request("http://localhost:5005/api/admin/colegios", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.colegios).toHaveLength(1);
    });
});
