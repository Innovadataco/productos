import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function ping(token?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return POST(
        new Request("http://localhost:5005/api/session/ping", {
            method: "POST",
            headers,
        })
    );
}

describe("POST /api/session/ping (SPEC-206)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("actualiza ultimaActividadEn de la sesión activa", async () => {
        const padre = await crearUsuario("PARENT", "padre-ping@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(Date.now() - 60_000),
                ultimaActividadEn: new Date(Date.now() - 60_000),
                ipHash: "abcd1234",
            },
        });
        mockToken = await createToken({ sub: padre.id, rol: padre.rol, sesionLogId: sesion.id });

        const res = await ping(mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);

        const actualizada = await prisma.sesionLog.findUnique({ where: { id: sesion.id } });
        expect(actualizada!.ultimaActividadEn.getTime()).toBeGreaterThan(sesion.ultimaActividadEn.getTime());
    });

    it("devuelve 401 si la sesión fue cerrada", async () => {
        const padre = await crearUsuario("PARENT", "padre-cerrado@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                cerradaEn: new Date(),
                motivoCierre: "FORZADA",
                ipHash: "abcd1234",
            },
        });
        mockToken = await createToken({ sub: padre.id, rol: padre.rol, sesionLogId: sesion.id });

        const res = await ping(mockToken);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe("AUTH_EXPIRED");
    });

    // SC-04 · SPEC-318: session/ping refresca la cookie sesion_estado
    it("ping exitoso incluye Set-Cookie con sesion_estado", async () => {
        const padre = await crearUsuario("PARENT", "sc318-ping@example.com");
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "test-hash",
            },
        });
        mockToken = await createToken({ sub: padre.id, rol: padre.rol, sesionLogId: sesion.id });
        const res = await ping(mockToken);
        expect(res.status).toBe(200);
        const setCookies = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie") ?? "";
        const cookieStr = Array.isArray(setCookies) ? setCookies.join("; ") : setCookies;
        expect(cookieStr).toContain("sesion_estado=");
    });

    it("token sin sesionLogId responde 200 sin tocar BD", async () => {
        const padre = await crearUsuario("PARENT", "padre-legacy@example.com");
        mockToken = await crearTokenUsuario(padre.id, padre.rol);

        const antes = await prisma.sesionLog.count();
        const res = await ping(mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(await prisma.sesionLog.count()).toBe(antes);
    });
});
