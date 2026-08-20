import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET } from "./route";
import { GET as GETDetalle } from "./[id]/route";
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

async function getSimular(query = "") {
    const req = new Request(`${BASE}${query}`, {
        method: "GET",
        headers: { cookie: `token=${activeToken}` },
    });
    const res = await GET(req);
    return { status: res.status, body: await res.json() };
}

async function getDetalle(id: string) {
    const req = new Request(`${BASE}/${id}`, {
        method: "GET",
        headers: { cookie: `token=${activeToken}` },
    });
    const res = await GETDetalle(req, { params: Promise.resolve({ id }) });
    return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/anti-abuso/simular (SPEC-184/185)", () => {
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
        expect(status).toBe(400);
        expect(body.error.message).toContain("RFC 5737");
    });

    it("rechaza IP privada", async () => {
        await autenticarAdmin();
        const { status, body } = await postSimular({ escenario: "personalizado", n: 1, ip: "10.0.0.1" });
        expect(status).toBe(400);
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

    it("falla loud con denunciante_spam sin usuarioId (400)", async () => {
        await autenticarAdmin();
        const { status, body } = await postSimular({ escenario: "denunciante_spam", n: 3 });
        expect(status).toBe(400);
        expect(body.error.message).toContain("simulacion.spam.usuario_id");
    });

    it("solo ADMIN puede simular", async () => {
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");
        const { status } = await postSimular({ escenario: "robot_inundando", n: 5 });
        expect(status).toBe(403);
    });
});

describe("GET /api/admin/anti-abuso/simular (SPEC-185)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("lista simulaciones paginadas", async () => {
        const admin = await autenticarAdmin();
        await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 5,
                creadoPorId: admin.id,
                estado: "COMPLETADA",
            },
        });
        const { status, body } = await getSimular("?page=1&pageSize=10");
        expect(status).toBe(200);
        expect(body.items).toHaveLength(1);
        expect(body.pagination.total).toBe(1);
        expect(body.pagination.page).toBe(1);
    });

    it("filtra por estado", async () => {
        const admin = await autenticarAdmin();
        await prisma.simulacionAbusoRun.create({
            data: { escenario: "robot_inundando", totalReportes: 5, creadoPorId: admin.id, estado: "COMPLETADA" },
        });
        await prisma.simulacionAbusoRun.create({
            data: { escenario: "ataque_coordinado", totalReportes: 5, creadoPorId: admin.id, estado: "PENDIENTE" },
        });
        const { status, body } = await getSimular("?estado=COMPLETADA");
        expect(status).toBe(200);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].estado).toBe("COMPLETADA");
    });

    it("filtra por escenario", async () => {
        const admin = await autenticarAdmin();
        await prisma.simulacionAbusoRun.create({
            data: { escenario: "robot_inundando", totalReportes: 5, creadoPorId: admin.id, estado: "COMPLETADA" },
        });
        await prisma.simulacionAbusoRun.create({
            data: { escenario: "ataque_coordinado", totalReportes: 5, creadoPorId: admin.id, estado: "COMPLETADA" },
        });
        const { status, body } = await getSimular("?escenario=ataque_coordinado");
        expect(status).toBe(200);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].escenario).toBe("ataque_coordinado");
    });

    it("devuelve detalle con descripcionEscenario, p50/p95 y detalles", async () => {
        const admin = await autenticarAdmin();
        const run = await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 2,
                creadoPorId: admin.id,
                estado: "COMPLETADA",
                resultadosJson: {
                    totalEnviados: 2,
                    totalBloqueados: 0,
                    totalSpam: 0,
                    latenciaPromedioMs: 100,
                    latenciaP50Ms: 90,
                    latenciaP95Ms: 150,
                    detalles: [
                        { idx: 0, ip: "192.0.2.10", identificador: "3000000001", status: 201, latenciaMs: 90, estado: "enviado" },
                        { idx: 1, ip: "192.0.2.10", identificador: "3000000002", status: 201, latenciaMs: 150, estado: "enviado" },
                    ],
                },
            },
        });
        const { status, body } = await getDetalle(run.id);
        expect(status).toBe(200);
        expect(body.run.estado).toBe("COMPLETADA");
        expect(body.run.descripcionEscenario).toContain("una sola IP");
        expect(body.run.latenciaP50Ms).toBe(90);
        expect(body.run.latenciaP95Ms).toBe(150);
        expect(body.run.detalles).toHaveLength(2);
    });
});
