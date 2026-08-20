import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
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

const BASE = "http://localhost:5005/api/admin/anti-abuso/simular";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    activeToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function postSimular(body: unknown) {
    const req = new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${activeToken}` },
        body: JSON.stringify(body),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/anti-abuso/simular (SPEC-184)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("crea una simulación con IP RFC 5737 por defecto", async () => {
        await autenticarAdmin();
        const { status, body } = await postSimular({ escenario: "robot_inundando", n: 5 });

        expect(status).toBe(201);
        expect(body.ok).toBe(true);
        expect(body.runId).toBeDefined();
        expect(body.estado).toBe("PENDIENTE");

        const run = await prisma.simulacionAbusoRun.findUnique({ where: { id: body.runId } });
        expect(run).not.toBeNull();
        expect(run?.escenario).toBe("robot_inundando");
        expect(run?.totalReportes).toBe(5);
    });

    it("rechaza IP real (8.8.8.8)", async () => {
        await autenticarAdmin();
        const { status, body } = await postSimular({ escenario: "personalizado", n: 1, ip: "8.8.8.8" });
        expect(status).toBe(500); // El endpoint envuelve el error de crearSimulacionAbuso como 500 con mensaje
        expect(body.error.message).toContain("RFC 5737");
    });

    it("rechaza IP privada", async () => {
        await autenticarAdmin();
        const { status, body } = await postSimular({ escenario: "personalizado", n: 1, ip: "10.0.0.1" });
        expect(status).toBe(500);
        expect(body.error.message).toContain("RFC 5737");
    });

    it("rechaza n fuera de rango", async () => {
        await autenticarAdmin();
        const { status } = await postSimular({ escenario: "robot_inundando", n: 500 });
        expect(status).toBe(400);
    });

    it("rechaza escenario inválido", async () => {
        await autenticarAdmin();
        const { status } = await postSimular({ escenario: "desconocido", n: 5 });
        expect(status).toBe(400);
    });

    it("solo ADMIN puede simular", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const { status } = await postSimular({ escenario: "robot_inundando", n: 5 });
        expect(status).toBe(403);
    });
});
