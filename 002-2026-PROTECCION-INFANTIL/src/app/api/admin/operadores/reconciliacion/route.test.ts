/**
 * SPEC-372 (A-74 · P3) — POST /api/admin/operadores/reconciliacion.
 *
 * Un solo trabajo: disparar `reconciliarHuerfanos` desde el admin, con los
 * mismos candados que el resto de operadores/*: solo ADMIN, módulo "operadores"
 * y rate-limit de escritura.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import * as rateLimit from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/operadores/reconciliacion";

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

async function crearOperadorActivo(suffix: string, cupoMaximo = 10) {
    const user = await crearUsuario("OPERADOR", `op-${suffix}-${Date.now()}@test.local`);
    await prisma.perfilOperador.create({
        data: { usuarioId: user.id, cupoMaximo, creadoPorId: user.id },
    });
    return user;
}

async function crearHuerfano(identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "texto huérfano",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
            operadorId: null,
        },
    });
}

function reqPost(): Request {
    return new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
    });
}

describe("POST /api/admin/operadores/reconciliacion (SPEC-372 · A-74 · P3)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        mockToken = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("asigna operador a los huérfanos y devuelve el resumen; audita RECONCILIACION_HUERFANOS", async () => {
        const admin = await autenticarAdmin();
        const operador = await crearOperadorActivo("a");
        const r1 = await crearHuerfano("+573001111111");
        const r2 = await crearHuerfano("+573002222222");

        const res = await POST(reqPost());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ encontrados: 2, asignados: 2, fallidos: 0 });

        const [a1, a2] = await Promise.all([
            prisma.reporte.findUnique({ where: { id: r1.id } }),
            prisma.reporte.findUnique({ where: { id: r2.id } }),
        ]);
        expect(a1?.operadorId).toBe(operador.id);
        expect(a2?.operadorId).toBe(operador.id);

        // La función escribe UN audit agregado — el mismo del cron —, sin duplicar
        // por admin: el rastro es uno solo, corra por acá o por el worker.
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "RECONCILIACION_HUERFANOS" },
        });
        expect(audit).not.toBeNull();
        const valor = JSON.parse(audit?.valorNuevo ?? "{}");
        expect(valor.asignados).toBe(2);
        expect(admin.id).toBeTruthy();
    });

    it("sin huérfanos: 200 y resumen en 0 (idempotente, no rompe si la cola ya está limpia)", async () => {
        await autenticarAdmin();
        await crearOperadorActivo("a");
        const res = await POST(reqPost());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ encontrados: 0, asignados: 0, fallidos: 0 });
    });

    it("respeta el parámetro `operadores.reconciliacion_enabled=false`: no toca reportes", async () => {
        await autenticarAdmin();
        await crearOperadorActivo("a");
        const huerfano = await crearHuerfano("+573003333333");
        await prisma.parametroSistema.update({
            where: { clave: "operadores.reconciliacion_enabled" },
            data: { valor: "false" },
        });

        const res = await POST(reqPost());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.deshabilitado).toBe(true);
        expect(body.asignados).toBe(0);
        const actualizado = await prisma.reporte.findUnique({ where: { id: huerfano.id } });
        expect(actualizado?.operadorId).toBeNull();
    });

    it("429 cuando se supera el rate-limit de escritura", async () => {
        await autenticarAdmin();
        vi.spyOn(rateLimit, "checkRateLimit").mockResolvedValue({
            allowed: false,
            limit: 30,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            headers: { "Retry-After": "60" },
        });

        const res = await POST(reqPost());
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    });

    it("403 para un usuario no admin (el candado de rol manda)", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new AppError("No autorizado", ERROR_CODES.FORBIDDEN, 403)
        );
        const res = await POST(new Request(URL, { method: "POST" }));
        expect(res.status).toBe(403);
    });
});
