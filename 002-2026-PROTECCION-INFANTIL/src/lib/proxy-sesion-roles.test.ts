/**
 * SPEC-113 (I-35/I-35b) — cada rol autenticado DEBE llegar a los endpoints de sesión.
 * No basta probar que el endpoint responde: hay que probar que CADA rol alcanza la
 * respuesta (verificar una respuesta no prueba que todos la alcancen).
 * Creado primero en ROJO contra el proxy actual: SCHOOL_ADMIN recibía 403 tanto en
 * /api/auth/cambiar-password como en /api/auth/logout (registrado en el cierre).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import type { RolUsuario } from "@prisma/client";

// El endpoint /api/auth/cambiar-password autentica con next/headers (no con el Request):
// el mock lo alimenta con el token de cada caso.
let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken ? { name, value: mockToken } : undefined,
    }),
}));

const ROLES: RolUsuario[] = ["SCHOOL_ADMIN", "PARENT", "ADMIN", "OPERADOR", "COMITE_VALIDACION"];
const ENDPOINTS_SESION = ["/api/auth/cambiar-password", "/api/auth/logout"];

function requestConToken(pathname: string, token: string): NextRequest {
    return new NextRequest(`http://localhost:5005${pathname}`, {
        method: "POST",
        headers: { cookie: `token=${token}` },
    });
}

describe("proxy — todos los roles llegan a los endpoints de sesión (SPEC-113)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        mockToken = undefined;
    });

    for (const rol of ROLES) {
        for (const endpoint of ENDPOINTS_SESION) {
            it(`${rol} llega a ${endpoint} (sin 403/401 del proxy)`, async () => {
                const usuario = await crearUsuario(rol, `${rol.toLowerCase()}-sesion@test.local`);
                const token = await crearTokenUsuario(usuario.id, rol);

                const res = await proxy(requestConToken(endpoint, token));

                // El proxy debe dejar pasar (NextResponse.next, status 200). Un 403 aquí es
                // el callejón de I-35/I-35b: el rol no alcanza el endpoint de sesión.
                expect(res.status, `${rol} bloqueado por el proxy en ${endpoint}`).not.toBe(403);
                expect(res.status).not.toBe(401);
            });
        }
    }

    it("SCHOOL_ADMIN con debeCambiarPassword=true completa el POST a /api/auth/cambiar-password (I-35)", async () => {
        // El efecto completo: no solo llega al endpoint — la contraseña cambia de verdad.
        const { POST } = await import("@/app/api/auth/cambiar-password/route");
        const usuario = await crearUsuario("SCHOOL_ADMIN", "colegio-i35@test.local");
        await prisma.usuario.update({ where: { id: usuario.id }, data: { debeCambiarPassword: true } });
        const token = await crearTokenUsuario(usuario.id, "SCHOOL_ADMIN");

        const viaProxy = await proxy(requestConToken("/api/auth/cambiar-password", token));
        expect(viaProxy.status).not.toBe(403);

        mockToken = token;
        const res = await POST(
            new Request("http://localhost:5005/api/auth/cambiar-password", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${token}` },
                body: JSON.stringify({ passwordActual: "TestPass123", passwordNueva: "NuevaClave2026" }),
            })
        );
        expect(res.status).toBe(200);

        const actualizado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
        expect(actualizado?.debeCambiarPassword).toBe(false);
        const { verifyPassword } = await import("@/lib/auth");
        expect(await verifyPassword("NuevaClave2026", actualizado!.passwordHash)).toBe(true);
    });
});
