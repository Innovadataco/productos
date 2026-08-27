import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as email from "@/lib/email";

let mockToken: string | undefined;
// SPEC-296 (002-PI-197): post-migración al motor, se mockean los wrappers
// enviarEmailBienvenidaOperador/Comite en vez de resend.emails.send(). El test
// prueba la lógica de la RUTA (audit log, nueva contraseña generada), no la
// entrega del email.
const enviarOperadorMock = vi.fn();
const enviarComiteMock = vi.fn();

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/operadores/[id]/reenviar-email", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        enviarOperadorMock.mockReset().mockResolvedValue(undefined);
        enviarComiteMock.mockReset().mockResolvedValue(undefined);
        vi.spyOn(email, "enviarEmailBienvenidaOperador").mockImplementation(enviarOperadorMock);
        vi.spyOn(email, "enviarEmailBienvenidaComite").mockImplementation(enviarComiteMock);
    });

    it("genera nueva contraseña, envía email y registra audit", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${operador.id}/reenviar-email`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: operador.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.emailEnviado).toBe(true);
        expect(data.operador.debeCambiarPassword).toBe(true);
        expect(enviarOperadorMock).toHaveBeenCalledOnce();
        const [emailArg, passwordArg] = enviarOperadorMock.mock.calls[0];
        expect(emailArg).toBe("op@example.com");
        expect(typeof passwordArg).toBe("string");
        expect(passwordArg.length).toBeGreaterThan(0);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "OPERADOR_EMAIL_REENVIADO", recursoId: operador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("genera nueva contraseña, envía email de comité y registra COMITE_EMAIL_REENVIADO", async () => {
        const admin = await crearUsuario("ADMIN");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: comite.id, creadoPorId: admin.id, esComite: true },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${comite.id}/reenviar-email`,
            {},
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: comite.id }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.emailEnviado).toBe(true);
        expect(data.mensaje).toContain("comité de validación");
        expect(enviarComiteMock).toHaveBeenCalledOnce();
        expect(enviarOperadorMock).not.toHaveBeenCalled();
        const [emailArg, passwordArg] = enviarComiteMock.mock.calls[0];
        expect(emailArg).toBe("comite@example.com");
        expect(typeof passwordArg).toBe("string");
        expect(passwordArg.length).toBeGreaterThan(0);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_EMAIL_REENVIADO", recursoId: comite.id },
        });
        expect(audit).not.toBeNull();
    });

    it("no expone la contraseña en el AuditLog", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        await prisma.perfilOperador.create({
            data: { usuarioId: operador.id, creadoPorId: admin.id },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost/api/admin/operadores/${operador.id}/reenviar-email`,
            {},
            mockToken
        );
        await POST(req, { params: Promise.resolve({ id: operador.id }) });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "OPERADOR_EMAIL_REENVIADO", recursoId: operador.id },
        });
        expect(audit?.valorNuevo).not.toContain("Contraseña temporal");
        expect(audit?.valorNuevo).toContain("op@example.com");
    });
});
