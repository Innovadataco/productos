import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import * as rateLimit from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/monitoreo/logs";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function autenticarNoAdmin(rol: "PARENT" | "OPERADOR" = "PARENT") {
    const user = await crearUsuario(rol);
    mockToken = await crearTokenUsuario(user.id, rol);
    return user;
}

function requestConBody(method: string, body: unknown): Request {
    return new Request(URL, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify(body),
    });
}

describe("GET /api/admin/monitoreo/logs (SPEC-193 Fase 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("devuelve logs paginados para un admin", async () => {
        await autenticarAdmin();
        await prisma.workerLog.createMany({
            data: [
                { servicio: "worker-reportes", nivel: "INFO", mensaje: "Procesamiento iniciado" },
                { servicio: "worker-reportes", nivel: "ERROR", mensaje: "Error de conexión" },
            ],
        });

        const res = await GET(new Request(URL, { headers: { cookie: `token=${mockToken}` } }));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.items).toHaveLength(2);
        expect(body.total).toBe(2);
    });

    it("filtra por servicio y nivel", async () => {
        await autenticarAdmin();
        await prisma.workerLog.createMany({
            data: [
                { servicio: "worker-reportes", nivel: "INFO", mensaje: "Mensaje A" },
                { servicio: "worker-reportes", nivel: "WARN", mensaje: "Mensaje B" },
                { servicio: "api-consulta", nivel: "INFO", mensaje: "Mensaje C" },
            ],
        });

        const res = await GET(
            new Request(`${URL}?servicio=worker-reportes&nivel=WARN`, {
                headers: { cookie: `token=${mockToken}` },
            })
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].nivel).toBe("WARN");
        expect(body.items.every((item: { servicio: string }) => item.servicio === "worker-reportes")).toBe(true);
    });

    it("devuelve 400 cuando 'desde' es posterior a 'hasta'", async () => {
        await autenticarAdmin();
        const res = await GET(
            new Request(`${URL}?desde=2026-08-10T00:00:00Z&hasta=2026-08-01T00:00:00Z`, {
                headers: { cookie: `token=${mockToken}` },
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("devuelve 429 cuando se supera el rate-limit", async () => {
        await autenticarAdmin();
        vi.spyOn(rateLimit, "checkRateLimit").mockResolvedValue({
            allowed: false,
            limit: 60,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            headers: { "Retry-After": "60" },
        });

        const res = await GET(new Request(URL, { headers: { cookie: `token=${mockToken}` } }));
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    });

    it("devuelve 403 para un usuario no admin y genera AuditLog", async () => {
        const user = await autenticarNoAdmin("PARENT");

        const res = await GET(new Request(URL, { headers: { cookie: `token=${mockToken}` } }));
        expect(res.status).toBe(403);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ACCESO_DENEGADO", usuarioId: user.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.tipoRecurso).toBe("WorkerLog");
    });

    it("devuelve 403 para un operador y genera AuditLog", async () => {
        const user = await autenticarNoAdmin("OPERADOR");

        const res = await GET(new Request(URL, { headers: { cookie: `token=${mockToken}` } }));
        expect(res.status).toBe(403);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ACCESO_DENEGADO", usuarioId: user.id },
        });
        expect(audit).not.toBeNull();
    });
});

describe("DELETE /api/admin/monitoreo/logs (SPEC-193 Fase 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("purga logs antiguos y genera un AuditLog", async () => {
        await autenticarAdmin();
        const ayer = new Date();
        ayer.setUTCDate(ayer.getUTCDate() - 1);
        ayer.setUTCHours(23, 59, 59, 0);

        await prisma.workerLog.createMany({
            data: [
                { servicio: "worker-reportes", nivel: "INFO", mensaje: "Log viejo", creadoEn: new Date("2026-01-01T00:00:00Z") },
                { servicio: "worker-reportes", nivel: "INFO", mensaje: "Log reciente", creadoEn: new Date() },
            ],
        });

        const res = await DELETE(
            requestConBody("DELETE", {
                hasta: ayer.toISOString(),
                servicio: "worker-reportes",
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        );
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.filasBorradas).toBe(1);

        const restantes = await prisma.workerLog.count();
        expect(restantes).toBe(1);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "LOGS_MANTENIMIENTO_PURGA" },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza purgar con fecha igual o posterior a hoy", async () => {
        await autenticarAdmin();
        const res = await DELETE(
            requestConBody("DELETE", {
                hasta: new Date().toISOString(),
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("rechaza motivo corto", async () => {
        await autenticarAdmin();
        const res = await DELETE(
            requestConBody("DELETE", {
                hasta: "2026-01-01T00:00:00Z",
                motivo: "Corto",
            })
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it("devuelve 429 cuando se supera el rate-limit de escritura", async () => {
        await autenticarAdmin();
        vi.spyOn(rateLimit, "checkRateLimit").mockResolvedValue({
            allowed: false,
            limit: 30,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            headers: { "Retry-After": "60" },
        });

        const res = await DELETE(
            requestConBody("DELETE", {
                hasta: "2026-01-01T00:00:00Z",
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        );
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    });

    it("devuelve 403 para un usuario no admin e intenta auditar", async () => {
        const user = await autenticarNoAdmin("PARENT");

        const res = await DELETE(
            requestConBody("DELETE", {
                hasta: "2026-01-01T00:00:00Z",
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        );
        expect(res.status).toBe(403);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ACCESO_DENEGADO", usuarioId: user.id },
        });
        expect(audit).not.toBeNull();
    });
});
