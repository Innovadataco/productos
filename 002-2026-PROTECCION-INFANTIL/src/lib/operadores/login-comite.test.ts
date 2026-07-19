import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as POSTLogin } from "@/app/api/auth/login/route";
import { POST as POSTCambiar } from "@/app/api/auth/cambiar-password/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { hashPassword, verifyPassword } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

async function seedParametrosSeguridad() {
    await prisma.$executeRaw`
        INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
        VALUES (${crypto.randomUUID()}, 'security.max_login_attempts', '5', 'INTEGER'::"TipoParametro", 'SECURITY'::"CategoriaParametro", false, NOW(), NOW())
        ON CONFLICT (clave) DO NOTHING
    `;
    await prisma.$executeRaw`
        INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
        VALUES (${crypto.randomUUID()}, 'security.lockout_duration_minutes', '30', 'INTEGER'::"TipoParametro", 'SECURITY'::"CategoriaParametro", false, NOW(), NOW())
        ON CONFLICT (clave) DO NOTHING
    `;
}

describe("Login y cambio de contraseña para comité", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
        await seedParametrosSeguridad();
    });

    it("el comité puede iniciar sesión con su contraseña temporal", async () => {
        const password = "TempPass123";
        const comite = await prisma.usuario.create({
            data: {
                email: "comite@example.com",
                nombre: "Comité",
                passwordHash: await hashPassword(password),
                rol: "COMITE_VALIDACION",
                estado: "activo",
                debeCambiarPassword: true,
            },
        });

        const res = await POSTLogin(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: comite.email, password }),
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.user.rol).toBe("COMITE_VALIDACION");
        expect(data.user.debeCambiarPassword).toBe(true);
    });

    it("el comité puede cambiar su contraseña", async () => {
        const passwordActual = "TempPass123";
        const comite = await prisma.usuario.create({
            data: {
                email: "comite@example.com",
                nombre: "Comité",
                passwordHash: await hashPassword(passwordActual),
                rol: "COMITE_VALIDACION",
                estado: "activo",
                debeCambiarPassword: true,
            },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POSTCambiar(
            new Request("http://localhost:5005/api/auth/cambiar-password", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({ passwordActual, passwordNueva: "NuevaPass456" }),
            })
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);

        const actualizado = await prisma.usuario.findUnique({ where: { id: comite.id } });
        expect(actualizado?.debeCambiarPassword).toBe(false);
        expect(await verifyPassword("NuevaPass456", actualizado!.passwordHash)).toBe(true);
    });
});
