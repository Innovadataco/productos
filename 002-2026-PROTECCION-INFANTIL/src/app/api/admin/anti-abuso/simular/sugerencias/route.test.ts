import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

describe("GET /api/admin/anti-abuso/simular/sugerencias", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("devuelve sugerencias para ADMIN", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.sugerencias.ipsSugeridas.length).toBeGreaterThan(0);
    });

    it("rechaza a no-admin", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(403);
    });
});
