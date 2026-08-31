import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta } from "@/lib/comite-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/colegio/comite/cuenta/reenviar-invitacion", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("SPEC-319 §2.2: reenvía la invitación (nuevo token, INVITADO) sin devolver contraseña", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        await crearComiteCuenta(colegio.id, "comite@colegio.test");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta/reenviar-invitacion",
                {},
                mockToken
            )
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.cuenta.email).toBe("comite@colegio.test");
        // Reenviar NO devuelve contraseña — el acceso llega por email.
        expect(data.passwordTemporal).toBeUndefined();
        expect(data.invitacionEnviada).toBe(true);

        // La cuenta queda INVITADO con un token nuevo para /activar.
        const cuentaDb = await prisma.usuario.findUnique({
            where: { email: "comite@colegio.test" },
            select: { estadoActivacion: true, tokenInvitacion: true },
        });
        expect(cuentaDb?.estadoActivacion).toBe("INVITADO");
        expect(cuentaDb?.tokenInvitacion).toHaveLength(64);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_COMITE_INVITACION_REENVIADA" },
        });
        expect(audit).not.toBeNull();
    });

    it("devuelve 404 si no existe la cuenta del comité", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                "http://localhost:5005/api/colegio/comite/cuenta/reenviar-invitacion",
                {},
                mockToken
            )
        );

        expect(res.status).toBe(404);
    });
});
