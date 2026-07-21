import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { GET as GETMeColegio } from "@/app/api/me/colegio/route";
import { POST as POSTLogin } from "@/app/api/auth/login/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarEmailBienvenidaColegio: vi.fn().mockResolvedValue(undefined),
    enviarEmailBienvenidaOperador: vi.fn().mockResolvedValue(undefined),
    enviarEmailBienvenidaComite: vi.fn().mockResolvedValue(undefined),
}));

function baseColegio(paisId: string, ciudadId: string, departamentoId?: string) {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 1);
    const fin = new Date(hoy);
    fin.setFullYear(fin.getFullYear() + 1);
    return {
        nombre: "Colegio Test",
        paisId,
        departamentoId,
        ciudadId,
        direccion: "Calle 1 # 1-1",
        representanteLegalNombre: "Representante Test",
        representanteLegalIdentificacion: "123456789",
        representanteLegalEmail: "rep@test.com",
        representanteLegalTelefono: "3000000000",
        inicioServicio: inicio.toISOString(),
        finServicio: fin.toISOString(),
        tipoPeriodo: "ANUAL",
        adminEmail: `colegio-admin-${Date.now()}@test.com`,
        adminNombre: "Admin Colegio",
    };
}

describe("/api/admin/colegios", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea un colegio con su usuario SCHOOL_ADMIN y devuelve password temporal", async () => {
        const admin = await crearUsuario("ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const body = baseColegio(pais.id, ciudad.id);
        const res = await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(body),
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.colegio.nombre).toBe("Colegio Test");
        expect(json.colegio.admin.rol).toBeUndefined();
        expect(json.colegio.admin.email).toBe(body.adminEmail.toLowerCase());
        expect(json.passwordTemporal).toHaveLength(12);
        expect(json.emailEnviado).toBe(true);

        const schoolAdmin = await prisma.usuario.findUnique({
            where: { email: body.adminEmail.toLowerCase() },
            include: { colegio: true },
        });
        expect(schoolAdmin).not.toBeNull();
        expect(schoolAdmin?.rol).toBe("SCHOOL_ADMIN");
        expect(schoolAdmin?.colegioId).toBe(json.colegio.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CREADO", recursoId: json.colegio.id },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza SCHOOL_ADMIN intentando crear colegio", async () => {
        const schoolAdmin = await crearUsuario("SCHOOL_ADMIN");
        mockToken = await crearTokenUsuario(schoolAdmin.id, "SCHOOL_ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();

        const res = await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(baseColegio(pais.id, ciudad.id)),
            })
        );

        expect(res.status).toBe(403);
    });

    it("rechaza crear colegio si el email del admin ya existe", async () => {
        const admin = await crearUsuario("ADMIN");
        const existing = await crearUsuario("PARENT", "duplicado@test.com");
        const { pais, ciudad } = await crearPaisCiudad();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const body = baseColegio(pais.id, ciudad.id);
        body.adminEmail = existing.email;

        const res = await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(body),
            })
        );

        expect(res.status).toBe(409);
    });

    it("lista colegios creados", async () => {
        const admin = await crearUsuario("ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(baseColegio(pais.id, ciudad.id)),
            })
        );

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

describe("/api/me/colegio", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN obtiene la información de su colegio", async () => {
        const admin = await crearUsuario("ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();
        const adminToken = await crearTokenUsuario(admin.id, "ADMIN");
        mockToken = adminToken;

        const createRes = await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(baseColegio(pais.id, ciudad.id)),
            })
        );
        expect(createRes.status).toBe(201);
        const createJson = await createRes.json();
        const schoolAdmin = await prisma.usuario.findUnique({
            where: { email: createJson.colegio.admin.email },
        });

        mockToken = await crearTokenUsuario(schoolAdmin!.id, "SCHOOL_ADMIN");
        const res = await GETMeColegio();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.colegio.id).toBe(createJson.colegio.id);
    });
});

describe("/api/auth/login vigencia SCHOOL_ADMIN", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("bloquea login de SCHOOL_ADMIN con servicio vencido", async () => {
        const admin = await crearUsuario("ADMIN");
        const { pais, ciudad } = await crearPaisCiudad();
        const adminToken = await crearTokenUsuario(admin.id, "ADMIN");
        mockToken = adminToken;

        const hoy = new Date();
        const inicio = new Date(hoy);
        inicio.setDate(inicio.getDate() - 60);
        const fin = new Date(hoy);
        fin.setDate(fin.getDate() - 30);

        const body = baseColegio(pais.id, ciudad.id);
        body.inicioServicio = inicio.toISOString();
        body.finServicio = fin.toISOString();

        const createRes = await POST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify(body),
            })
        );
        expect(createRes.status).toBe(201);
        const createJson = await createRes.json();

        const loginRes = await POSTLogin(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: createJson.colegio.admin.email,
                    password: createJson.passwordTemporal,
                }),
            })
        );

        expect(loginRes.status).toBe(403);
        const loginJson = await loginRes.json();
        expect(loginJson.error.code).toBe("FORBIDDEN");
    });
});
