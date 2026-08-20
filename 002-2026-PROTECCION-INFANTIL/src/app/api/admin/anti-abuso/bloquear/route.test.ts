import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { calcularIpHash } from "@/lib/anti-abuso/fuente-reporte";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

const BASE = "http://localhost:5005/api/admin/anti-abuso/bloquear";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    activeToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function postBloquear(body: unknown) {
    const req = new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${activeToken}` },
        body: JSON.stringify(body),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/anti-abuso/bloquear (SPEC-184)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("401 sin token", async () => {
        const req = new Request(BASE, { method: "POST", headers: { "Content-Type": "application/json" } });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("bloquea una IP con motivo y duración", async () => {
        await autenticarAdmin();
        const ipHash = calcularIpHash("192.0.2.10");
        const { status, body } = await postBloquear({ ipHash, motivo: "Robot inundando", duracion: "24h" });

        expect(status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.bloqueo.ipHash).toBe(ipHash);
        expect(body.bloqueo.motivo).toBe("Robot inundando");
        expect(body.bloqueo.expiraEn).not.toBeNull();

        const count = await prisma.blockList.count({ where: { ipHash } });
        expect(count).toBe(1);
    });

    it("rechaza ipHash mal formado", async () => {
        await autenticarAdmin();
        const { status, body } = await postBloquear({ ipHash: "no-valido", motivo: "X", duracion: "24h" });
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza motivo vacío", async () => {
        await autenticarAdmin();
        const ipHash = calcularIpHash("192.0.2.10");
        const { status } = await postBloquear({ ipHash, motivo: "", duracion: "24h" });
        expect(status).toBe(400);
    });

    it("rechaza rol no ADMIN", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const ipHash = calcularIpHash("192.0.2.10");
        const { status } = await postBloquear({ ipHash, motivo: "X", duracion: "24h" });
        expect(status).toBe(403);
    });
});
