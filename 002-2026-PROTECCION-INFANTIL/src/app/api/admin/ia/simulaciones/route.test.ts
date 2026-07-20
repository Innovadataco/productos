import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

vi.mock("pg-boss", () => ({
    PgBoss: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
    })),
}));

async function seedPlataforma() {
    await prisma.plataforma.upsert({
        where: { clave: "instagram" },
        update: {},
        create: { clave: "instagram", nombre: "Instagram" },
    });
}

describe("POST /api/admin/ia/simulaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedPlataforma();
    });

    it("creates a simulation run from CSV and enqueues a job", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const csv = `texto,plataforma,identificador,categoriaEsperada
"Este es un texto de prueba con más de 20 caracteres para la simulación",instagram,usuario123,ACOSO`;

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/simulaciones", {
            modelo: "ornith:9b",
            archivo: csv,
            formato: "csv",
        });

        const res = await POST(req);
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.runId).toBeDefined();
        expect(body.totalCasos).toBe(1);

        const run = await prisma.simulacionRun.findUnique({ where: { id: body.runId } });
        expect(run).not.toBeNull();
        expect(run?.modelo).toBe("ornith:9b");
        expect(run?.totalCasos).toBe(1);
    });

    it("rejects an embedding model", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/simulaciones", {
            modelo: "nomic-embed-text",
            archivo: `texto,plataforma,identificador\n"texto de prueba suficientemente largo",instagram,usuario123`,
            formato: "csv",
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rejects more than max cases", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const casos = Array.from({ length: 201 }, (_, i) => ({
            texto: `texto de prueba suficientemente largo ${i}`,
            plataforma: "instagram",
            identificador: `usuario${i}`,
        }));

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/simulaciones", {
            modelo: "ornith:9b",
            archivo: JSON.stringify(casos),
            formato: "json",
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rejects a second run while one is in progress", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 5, estado: "EN_PROGRESO", creadoPorId: admin.id },
        });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/simulaciones", {
            modelo: "ornith:9b",
            archivo: JSON.stringify([{ texto: "texto de prueba suficientemente largo", plataforma: "instagram", identificador: "usuario123" }]),
            formato: "json",
        });

        const res = await POST(req);
        expect(res.status).toBe(409);
    });
});

describe("GET /api/admin/ia/simulaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("lists simulation runs", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 10, estado: "COMPLETADA", creadoPorId: admin.id },
        });

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/simulaciones", null);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
    });
});
