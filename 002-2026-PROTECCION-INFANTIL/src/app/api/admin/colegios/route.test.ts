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
        // SPEC-320 (§2.2-bis): NIT obligatorio, único global (aleatorio por llamada).
        nit: `NIT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

    it("admite payload legacy completo para journeys existentes (SPEC-114/133)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const pais = await prisma.pais.findUnique({ where: { codigo: "CO" } });
        const ciudad = await prisma.ciudad.findFirst({ where: { paisId: pais!.id } });
        const email = `legacy-${Date.now()}@test.com`;
        const inicio = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const res = await POST(
            postRequest(mockToken, {
                nombre: `Colegio Legacy ${Date.now()}`,
                nit: `NIT-LEGACY-${Date.now()}`, // SPEC-320 (§2.2-bis)
                paisId: pais!.id,
                ciudadId: ciudad!.id,
                representanteLegalNombre: "Rector Legacy",
                representanteLegalIdentificacion: "CC-12345",
                representanteLegalEmail: email,
                inicioServicio: inicio.toISOString(),
                finServicio: new Date(inicio.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                tipoPeriodo: "ANUAL",
                adminEmail: email,
                adminNombre: "Admin Legacy",
            })
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.passwordTemporal).toBeTruthy();
        expect(json.colegio.admin.debeCambiarPassword).toBe(true);
        expect(json.colegio.admin.email).toBe(email.toLowerCase());
    });
});
