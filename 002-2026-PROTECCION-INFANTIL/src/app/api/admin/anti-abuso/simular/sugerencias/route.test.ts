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

    it("devuelve sugerencias para escenario robot_inundando", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias?escenario=robot_inundando", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.sugerencias.escenario).toBe("robot_inundando");
        expect(body.sugerencias.n).toBe(50);
        expect(body.sugerencias.ip).toMatch(/^192\.0\.2\.\d+$/);
    });

    it("devuelve rango de IPs para ataque_coordinado", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias?escenario=ataque_coordinado", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        const body = await res.json();
        expect(body.sugerencias.ips).toHaveLength(30);
        expect(body.sugerencias.identificador).toBeDefined();
    });

    it("rechaza escenario inválido", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias?escenario=desconocido", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("rechaza a no-admin", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const req = new Request("http://localhost:5005/api/admin/anti-abuso/simular/sugerencias?escenario=robot_inundando", {
            headers: { cookie: `token=${activeToken}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(403);
    });
});
