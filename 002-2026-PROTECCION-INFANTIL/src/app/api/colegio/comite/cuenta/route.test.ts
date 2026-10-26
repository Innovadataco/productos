import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/comite/cuenta", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("retorna null cuando el colegio aún no tiene cuenta de comité", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/colegio/comite/cuenta", {
                headers: { cookie: `token=${mockToken}` },
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cuenta).toBeNull();
    });

    it("SPEC-319 §2.2: crea la cuenta como INVITADO con token y NO devuelve contraseña", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "comite@colegio.test" },
                mockToken
            )
        );

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.cuenta.email).toBe("comite@colegio.test");
        expect(data.cuenta.estado).toBe("activo");
        // El acceso llega por email: NUNCA se devuelve una contraseña en la respuesta.
        expect(data.passwordTemporal).toBeUndefined();
        expect(data.invitacionEnviada).toBe(true);

        // La cuenta nace INVITADO con token de invitación (para /activar), sin clave usable.
        const cuentaDb = await prisma.usuario.findUnique({
            where: { email: "comite@colegio.test" },
            select: { estadoActivacion: true, tokenInvitacion: true, tokenInvitacionExpiraEn: true, rol: true },
        });
        expect(cuentaDb?.rol).toBe("COMITE_CONVIVENCIA");
        expect(cuentaDb?.estadoActivacion).toBe("INVITADO");
        expect(cuentaDb?.tokenInvitacion).toHaveLength(64);
        expect(cuentaDb?.tokenInvitacionExpiraEn).not.toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_CREADO" },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza crear una segunda cuenta para el mismo colegio", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: {
                email: "existente@colegio.test",
                passwordHash: "x",
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                comiteColegioId: colegio.id,
            },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "nueva@colegio.test" },
                mockToken
            )
        );

        expect(res.status).toBe(409);
    });

    it("rechaza un email ya usado por otro usuario", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: { email: "usado@test.com", passwordHash: "x", rol: "PARENT", estado: "activo" },
        });

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta",
                { email: "usado@test.com" },
                mockToken
            )
        );

        expect(res.status).toBe(409);
    });

    // SPEC-912 · CANDADO: la cuenta del comité se puede EDITAR (cambiar el email del registro).
    const URL = "http://localhost:5005/api/colegio/comite/cuenta";

    it("SPEC-912: PATCH cambia el email (cuenta activada) + AuditLog con antes/después", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: {
                email: "viejo@colegio.test",
                passwordHash: "x",
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                estadoActivacion: "ACTIVO",
                comiteColegioId: colegio.id,
            },
        });

        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { email: "nuevo@colegio.test" }, mockToken));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cuenta.email).toBe("nuevo@colegio.test");
        expect(data.invitacionEnviada).toBe(false); // ya activada → NO reenvía
        expect(data.passwordTemporal).toBeUndefined(); // nunca contraseña (SPEC-319 §2.2)

        const enDb = await prisma.usuario.findUnique({ where: { comiteColegioId: colegio.id }, select: { email: true } });
        expect(enDb?.email).toBe("nuevo@colegio.test");

        const audit = await prisma.auditLog.findFirst({ where: { accion: "COLEGIO_COMITE_EMAIL_ACTUALIZADO" } });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toContain("viejo@colegio.test");
        expect(audit?.valorNuevo).toContain("nuevo@colegio.test");
    });

    it("SPEC-912: PATCH reenvía la invitación (token nuevo, email nuevo) si sigue INVITADO", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: {
                email: "inv@colegio.test",
                passwordHash: "x",
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                estadoActivacion: "INVITADO",
                tokenInvitacion: "a".repeat(64),
                tokenInvitacionExpiraEn: new Date(Date.now() + 3600_000),
                comiteColegioId: colegio.id,
            },
        });

        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { email: "inv-nuevo@colegio.test" }, mockToken));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.invitacionEnviada).toBe(true);

        const enDb = await prisma.usuario.findUnique({
            where: { comiteColegioId: colegio.id },
            select: { email: true, tokenInvitacion: true, estadoActivacion: true },
        });
        expect(enDb?.email).toBe("inv-nuevo@colegio.test");
        expect(enDb?.tokenInvitacion).not.toBe("a".repeat(64)); // token regenerado
        expect(enDb?.estadoActivacion).toBe("INVITADO");
    });

    it("SPEC-912: PATCH rechaza (409) un email ya usado por otro usuario", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await prisma.usuario.create({
            data: { email: "cuenta@colegio.test", passwordHash: "x", rol: "COMITE_CONVIVENCIA", estado: "activo", estadoActivacion: "ACTIVO", comiteColegioId: colegio.id },
        });
        await prisma.usuario.create({
            data: { email: "ocupado@test.com", passwordHash: "x", rol: "PARENT", estado: "activo" },
        });

        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { email: "ocupado@test.com" }, mockToken));
        expect(res.status).toBe(409);
    });

    it("SPEC-912: PATCH 404 si el colegio no tiene cuenta de comité", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const res = await PATCH(crearRequestAutenticado("PATCH", URL, { email: "x@colegio.test" }, mockToken));
        expect(res.status).toBe(404);
    });
});
