/**
 * SPEC-236 (002-PI-mega-cola): tests de integración del endpoint
 * POST /api/interno/expediente/[id]/transicionar (US5).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

const MIN_EVENTOS = 2;

async function seedParametros() {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.expediente.consolidacion_min_reportes" },
        update: { valor: String(MIN_EVENTOS) },
        create: {
            clave: "padre.expediente.consolidacion_min_reportes",
            valor: String(MIN_EVENTOS),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

async function crearExpediente(padreId: string, numEventos = 0) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57301${Math.floor(Date.now() % 1000000)}`,
            fechaApertura: new Date(),
            estado: "ACTIVO",
            numEventos,
            ultimoEventoEn: new Date(),
        },
    });
}

function requestTransicion(id: string, body: unknown, headers: Record<string, string> = {}) {
    return new Request(`http://localhost:5005/api/interno/expediente/${id}/transicionar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
}

describe("POST /api/interno/expediente/[id]/transicionar (SPEC-236)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametros();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: ADMIN con transición válida y guards satisfechos (US5.1)", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const exp = await crearExpediente(padre.id, MIN_EVENTOS);

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "CONSOLIDANDO", motivo: "ok" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.expediente.estado).toBe("CONSOLIDANDO");
    });

    it("403: PARENT no puede transicionar salvo reapertura (US5.2)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const exp = await crearExpediente(padre.id, MIN_EVENTOS);

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "CONSOLIDANDO" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(403);
    });

    it("200: PARENT reabre su propio expediente CERRADO → ESCALADO (US1.10)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const exp = await crearExpediente(padre.id);
        await prisma.expediente.update({ where: { id: exp.id }, data: { estado: "CERRADO" } });

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "ESCALADO", motivo: "Reapertura" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.expediente.estado).toBe("ESCALADO");
    });

    it("403: PARENT no puede reabrir expediente ajeno", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        const exp = await crearExpediente(padre.id);
        await prisma.expediente.update({ where: { id: exp.id }, data: { estado: "CERRADO" } });

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "ESCALADO" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(403);
    });

    it("409: guard rechaza la transición y el estado no cambia (US5.4)", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const exp = await crearExpediente(padre.id, 0);

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "CONSOLIDANDO" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(409);
        const sinCambio = await prisma.expediente.findUnique({ where: { id: exp.id } });
        expect(sinCambio?.estado).toBe("ACTIVO");
    });

    it("404: expediente inexistente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(requestTransicion("no-existe", { estadoDestino: "CONSOLIDANDO" }), {
            params: Promise.resolve({ id: "no-existe" }),
        });
        expect(res.status).toBe(404);
    });

    it("200: cuenta de servicio con X-Worker-Secret (US5.3)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, MIN_EVENTOS);

        const res = await POST(
            requestTransicion(exp.id, { estadoDestino: "CONSOLIDANDO" }, { "x-worker-secret": process.env.WORKER_SECRET! }),
            { params: Promise.resolve({ id: exp.id }) }
        );
        expect(res.status).toBe(200);
    });

    it("401: sin autenticación", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, MIN_EVENTOS);

        const res = await POST(requestTransicion(exp.id, { estadoDestino: "CONSOLIDANDO" }), {
            params: Promise.resolve({ id: exp.id }),
        });
        expect(res.status).toBe(401);
    });

    it("400: estadoDestino inválido (Zod)", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(requestTransicion("cualquiera", { estadoDestino: "VOLANDO" }), {
            params: Promise.resolve({ id: "cualquiera" }),
        });
        expect(res.status).toBe(400);
    });
});
