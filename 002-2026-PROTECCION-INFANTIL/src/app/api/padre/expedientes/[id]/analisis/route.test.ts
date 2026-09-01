/**
 * SPEC-341 (T033/T041) · GET+POST /api/padre/expedientes/[id]/analisis.
 *
 * Cobertura: boundary PARENT dueña (403/404), encolado al abrir sin análisis,
 * idempotencia por (expediente, hash), cool-down del POST, ya-al-día,
 * cola llena.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { prisma } from "@/lib/prisma";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            if ((name === "token" || name === "__Host-token") && mockToken) {
                return { name, value: mockToken };
            }
            return undefined;
        },
    }),
}));

// Mock del envío a pg-boss: los tests no arrancan la cola.
// El DAL sí crea la fila GENERANDO en BD (candado UI).
vi.mock("@/lib/queue", async () => {
    const actual = await vi.importActual<typeof import("@/lib/queue")>("@/lib/queue");
    return {
        ...actual,
        sendAnalisisExpediente: vi.fn(async () => ({ encolado: true, jobId: "fake-job" })),
        getAnalisisQueueStats: vi.fn(async () => ({ pendientes: 1 })),
    };
});

async function seedExpediente(padreId: string, opts?: { conEvento?: boolean }) {
    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: `@test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        plataformaId: "instagram",
    });
    if (opts?.conEvento) {
        await repo.agregarEvento({ expedienteId: expediente.id, texto: "un hecho breve" });
    }
    return expediente;
}

function req(method: "GET" | "POST", id: string): Request {
    return new Request(`http://localhost:5005/api/padre/expedientes/${id}/analisis`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
    });
}

describe("GET /api/padre/expedientes/[id]/analisis (SPEC-341)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("403 si el usuario no es PARENT", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(req("GET", "cualquier-id"), { params: Promise.resolve({ id: "cualquier-id" }) });
        expect(res.status).toBe(403);
    });

    it("404 si el expediente no pertenece al padre", async () => {
        const padreA = await crearUsuario("PARENT");
        const padreB = await crearUsuario("PARENT");
        const expB = await seedExpediente(padreB.id, { conEvento: true });
        mockToken = await crearTokenUsuario(padreA.id, "PARENT");
        const res = await GET(req("GET", expB.id), { params: Promise.resolve({ id: expB.id }) });
        expect(res.status).toBe(404);
    });

    it("sin análisis previo + con eventos → encola y devuelve GENERANDO + cola.posicion=1", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET(req("GET", exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.vigente).toBeNull();
        expect(body.estado).toBe("GENERANDO");
        expect(body.cola).toEqual({ posicion: 1, estimadoSeg: expect.any(Number) });

        // Fila placeholder GENERANDO persistida
        const filas = await prisma.analisisExpediente.findMany({ where: { expedienteId: exp.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toBe("GENERANDO");
    });

    it("dos aperturas seguidas del mismo expediente NO crean dos filas GENERANDO", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await GET(req("GET", exp.id), { params: Promise.resolve({ id: exp.id }) });
        await GET(req("GET", exp.id), { params: Promise.resolve({ id: exp.id }) });

        const filas = await prisma.analisisExpediente.count({ where: { expedienteId: exp.id } });
        expect(filas).toBe(1);
    });

    it("expediente sin eventos → NO encola nada", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id); // sin evento
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET(req("GET", exp.id), { params: Promise.resolve({ id: exp.id }) });
        const body = await res.json();
        expect(body.estado).toBe("SIN_ANALISIS");

        const filas = await prisma.analisisExpediente.count({ where: { expedienteId: exp.id } });
        expect(filas).toBe(0);
    });
});

describe("POST /api/padre/expedientes/[id]/analisis (SPEC-341 · Actualizar)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("con vigente reciente → 200 motivo=cooldown", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });
        // Sembrar un vigente PUBLICADO reciente
        await prisma.analisisExpediente.create({
            data: {
                expedienteId: exp.id,
                versionSecuencial: 1,
                alcance: "PADRE_COMPLETO",
                hashCadena: "x".repeat(64),
                corteN: 1,
                texto: "análisis previo",
                modeloUsado: "test", promptSistemaHash: "h", latenciaMs: 100,
                estado: "PUBLICADO",
                publicadoEn: new Date(),
                generadoEn: new Date(),
            },
        });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(req("POST", exp.id), { params: Promise.resolve({ id: exp.id }) });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.encolado).toBe(false);
        expect(body.motivo).toBe("cooldown");
        expect(body.faltanSeg).toBeGreaterThan(0);
    });

    it("con vigente ANTIGUO y hash coincidente → motivo=ya_al_dia (no encola)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });

        // Calcular hash actual del expediente para sembrar coincidente
        const { calcularHashCadena } = await import("@/lib/expediente/analisis/hash-cadena");
        const expRow = await prisma.expediente.findUnique({
            where: { id: exp.id },
            select: { ultimoEventoEn: true, numEventos: true, categoriasDominantesJson: true },
        });
        const hash = calcularHashCadena({
            ultimoEventoEn: expRow!.ultimoEventoEn,
            numEventos: expRow!.numEventos,
            categoriasDominantesJson: expRow!.categoriasDominantesJson,
        });

        const hace1Hora = new Date(Date.now() - 60 * 60 * 1000);
        await prisma.analisisExpediente.create({
            data: {
                expedienteId: exp.id,
                versionSecuencial: 1,
                alcance: "PADRE_COMPLETO",
                hashCadena: hash,
                corteN: 1,
                texto: "análisis del hash actual",
                modeloUsado: "test", promptSistemaHash: "h", latenciaMs: 100,
                estado: "PUBLICADO",
                publicadoEn: hace1Hora,
                generadoEn: hace1Hora,
            },
        });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(req("POST", exp.id), { params: Promise.resolve({ id: exp.id }) });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.encolado).toBe(false);
        expect(body.motivo).toBe("ya_al_dia");

        // No se creó nueva fila GENERANDO
        const filas = await prisma.analisisExpediente.count({ where: { expedienteId: exp.id } });
        expect(filas).toBe(1);
    });
});

// Audit #214 · candado 1 (placeholder eterno) — el DAL trata un GENERANDO viejo
// como muerto y reencola en la siguiente apertura.
describe("SPEC-341 · placeholder GENERANDO huérfano (audit #214)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("un GENERANDO más viejo que tiempo_estimado*3 → se marca FALLIDO y la GET reencola", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });

        // Calcular hash actual y sembrar placeholder viejo con ese hash.
        const { calcularHashCadena } = await import("@/lib/expediente/analisis/hash-cadena");
        const row = await prisma.expediente.findUnique({
            where: { id: exp.id },
            select: { ultimoEventoEn: true, numEventos: true, categoriasDominantesJson: true },
        });
        const hash = calcularHashCadena({
            ultimoEventoEn: row!.ultimoEventoEn,
            numEventos: row!.numEventos,
            categoriasDominantesJson: row!.categoriasDominantesJson,
        });

        // tiempo_estimado_seg default = 90 → ventana muerta = 270s.
        // Sembramos placeholder de hace 1 hora.
        const hace1Hora = new Date(Date.now() - 3600 * 1000);
        await prisma.analisisExpediente.create({
            data: {
                expedienteId: exp.id, versionSecuencial: 1, alcance: "PADRE_COMPLETO",
                hashCadena: hash, corteN: 0, texto: "",
                modeloUsado: "?", promptSistemaHash: "?", latenciaMs: 0,
                estado: "GENERANDO", generadoEn: hace1Hora,
            },
        });

        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await GET(req("GET", exp.id), { params: Promise.resolve({ id: exp.id }) });

        // El placeholder viejo quedó marcado FALLIDO
        const viejo = await prisma.analisisExpediente.findFirst({
            where: { expedienteId: exp.id, generadoEn: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
        });
        expect(viejo?.estado).toBe("FALLIDO");
        expect(viejo?.motivoFallo).toBe("worker_no_completo");

        // Y la apertura encoló un nuevo placeholder GENERANDO
        const nuevos = await prisma.analisisExpediente.count({
            where: { expedienteId: exp.id, estado: "GENERANDO" },
        });
        expect(nuevos).toBe(1);
    });
});

// Audit #214 · fix nº5 · el POST rechaza por cooldown ANTES de encolar
describe("SPEC-341 · POST cool-down se chequea antes de tocar la cola (audit #214)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("con vigente en cooldown, POST no crea placeholder GENERANDO nuevo", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await seedExpediente(padre.id, { conEvento: true });
        await prisma.analisisExpediente.create({
            data: {
                expedienteId: exp.id, versionSecuencial: 1, alcance: "PADRE_COMPLETO",
                hashCadena: "x".repeat(64), corteN: 1, texto: "análisis reciente",
                modeloUsado: "m", promptSistemaHash: "h", latenciaMs: 100,
                estado: "PUBLICADO", publicadoEn: new Date(), generadoEn: new Date(),
            },
        });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await POST(req("POST", exp.id), { params: Promise.resolve({ id: exp.id }) });

        // Solo la fila PUBLICADO sembrada, cero GENERANDO nuevas.
        const generando = await prisma.analisisExpediente.count({
            where: { expedienteId: exp.id, estado: "GENERANDO" },
        });
        expect(generando).toBe(0);
    });
});
