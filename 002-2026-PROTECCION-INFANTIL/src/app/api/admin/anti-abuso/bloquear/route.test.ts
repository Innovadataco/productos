import { createHash } from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

function hashIp(ip: string): string {
    return createHash("sha256").update(ip.trim().toLowerCase()).digest("hex");
}

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

    it("bloquea una IP en claro calculando el hash en el backend", async () => {
        await autenticarAdmin();
        const ip = "192.0.2.10";
        const ipHash = hashIp(ip);
        const { status, body } = await postBloquear({ ip, motivo: "Robot inundando", duracion: "24h" });

        expect(status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.bloqueo.ipHash).toBe(ipHash);
        expect(body.bloqueo.ipOriginal).toBe(ip);
        expect(body.bloqueo.motivo).toBe("Robot inundando");
        expect(body.bloqueo.expiraEn).not.toBeNull();

        const count = await prisma.blockList.count({ where: { ipHash } });
        expect(count).toBe(1);
    });

    it("normaliza a minúsculas al hashear IPv6", async () => {
        await autenticarAdmin();
        const ip = "2001:0DB8:0000:0000:0000:0000:0000:0001";
        const ipHash = hashIp(ip.toLowerCase());
        const { status, body } = await postBloquear({ ip, motivo: "IPv6 de prueba", duracion: "7d" });

        expect(status).toBe(200);
        expect(body.bloqueo.ipHash).toBe(ipHash);
    });

    it("rechaza IP inválida", async () => {
        await autenticarAdmin();
        const { status, body } = await postBloquear({ ip: "no-valido", motivo: "X", duracion: "24h" });
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza motivo vacío", async () => {
        await autenticarAdmin();
        const { status } = await postBloquear({ ip: "192.0.2.10", motivo: "", duracion: "24h" });
        expect(status).toBe(400);
    });

    it("rechaza rol no ADMIN", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const { status } = await postBloquear({ ip: "192.0.2.10", motivo: "X", duracion: "24h" });
        expect(status).toBe(403);
    });
});
