/**
 * SPEC-603 (hotfix) · GET /api/me con sesión huérfana (JWT válido de un usuario
 * ya eliminado de la BD).
 *
 * Candados por conducta contra BD real:
 *   · usuario eliminado → 401 limpio (AppError, sin stack trace) y la respuesta
 *     EXPIRA ambas cookies de sesión (`__Host-token` y `token`): sin ese
 *     Set-Cookie el navegador conserva la cookie huérfana y reintenta en loop
 *     en cada carga de página (síntoma visto en producción).
 *   · usuario activo → 200 con su perfil (flujo sano intacto).
 *   · sin cookie → 401 y también expira cookies (idempotente, inocuo).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
        set: vi.fn(),
    }),
}));

import { GET } from "./route";

function cookiesExpiradas(res: Response): string[] {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    return setCookies.filter((c) => /^(token|__Host-token)=;/.test(c) && /Max-Age=0/.test(c));
}

describe("GET /api/me · sesión huérfana (SPEC-603)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("JWT de usuario eliminado → 401 limpio y cookies de sesión expiradas (corta el loop)", async () => {
        const padre = await crearUsuario("PARENT", "huerfano-me@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await prisma.usuario.delete({ where: { id: padre.id } });

        const res = await GET();
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe("AUTH_INVALID");

        const expiradas = cookiesExpiradas(res);
        expect(expiradas.some((c) => c.startsWith("__Host-token="))).toBe(true);
        expect(expiradas.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("usuario activo → 200 con su perfil y sin expirar cookies", async () => {
        const padre = await crearUsuario("PARENT", "sano-me@example.com");
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        const res = await GET();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(padre.id);
        expect(json.email).toBe("sano-me@example.com");
        expect(cookiesExpiradas(res)).toHaveLength(0);
    });

    it("sin cookie → 401 con cookies expiradas", async () => {
        const res = await GET();
        expect(res.status).toBe(401);
        expect(cookiesExpiradas(res)).toHaveLength(2);
    });
});
