import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;
const sendMock = vi.fn();

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("resend", () => ({
    Resend: vi.fn(() => ({
        emails: { send: (...args: unknown[]) => sendMock(...args) },
    })),
}));

describe("POST /api/admin/operadores/[id]/reenviar-email", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        sendMock.mockReset().mockResolvedValue({ id: "email-id" });
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
        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toBe("op@example.com");
        expect(args.text).toContain("Contraseña temporal");

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
        expect(sendMock).toHaveBeenCalledOnce();
        const args = sendMock.mock.calls[0][0];
        expect(args.to).toBe("comite@example.com");
        expect(args.subject).toContain("comité de validación");
        expect(args.text).toContain("comité de validación");

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
