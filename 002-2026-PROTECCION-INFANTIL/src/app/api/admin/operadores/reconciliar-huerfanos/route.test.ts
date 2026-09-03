import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { ESTADOS_CARGA_OPERADOR } from "@/lib/operadores/estados";

const URL = "http://localhost:5005/api/admin/operadores/reconciliar-huerfanos";

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

async function crearOperadorActivo(suffix: string) {
    const user = await crearUsuario("OPERADOR", `op-${suffix}-${Date.now()}@test.local`);
    await prisma.perfilOperador.create({
        data: {
            usuarioId: user.id,
            cupoMaximo: 10,
            creadoPorId: user.id,
        },
    });
    return user;
}

async function crearReporteHuerfano() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba anonimizado",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: ESTADOS_CARGA_OPERADOR[0],
            esAnonimo: true,
            operadorId: null,
        },
    });
}

function requestPost(): Request {
    return new Request(URL, {
        method: "POST",
        headers: { cookie: `token=${mockToken}` },
    });
}

describe("POST /api/admin/operadores/reconciliar-huerfanos (SPEC-372 · A-74 P3)", () => {
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

    it("dispara la reconciliación, asigna huérfanos a operador libre y audita el disparo", async () => {
        const admin = await autenticarAdmin();
        const operador = await crearOperadorActivo("libre");
        const huerfano = await crearReporteHuerfano();

        const res = await POST(requestPost());
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.encontrados).toBeGreaterThanOrEqual(1);
        expect(body.asignados).toBeGreaterThanOrEqual(1);
        expect(body.fallidos).toBe(0);

        const asignado = await prisma.reporte.findUnique({ where: { id: huerfano.id } });
        expect(asignado?.operadorId).toBe(operador.id);

        // La reconciliación audita internamente cuando hay asignados, y el
        // endpoint audita ADEMÁS el disparo manual con el admin que lo pidió.
        const auditManual = await prisma.auditLog.findFirst({
            where: { accion: "RECONCILIACION_HUERFANOS", usuarioId: admin.id, tipoRecurso: "Operador" },
        });
        expect(auditManual).not.toBeNull();
        const parsed = auditManual?.valorNuevo ? JSON.parse(auditManual.valorNuevo) : null;
        expect(parsed?.disparo).toBe("manual");
        expect(parsed?.asignados).toBeGreaterThanOrEqual(1);
    });

    it("sin huérfanos devuelve el resumen en cero y no falla", async () => {
        await autenticarAdmin();
        await crearOperadorActivo("libre");

        const res = await POST(requestPost());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.encontrados).toBe(0);
        expect(body.asignados).toBe(0);
        expect(body.fallidos).toBe(0);
    });

    it("rechaza cuando no hay sesión", async () => {
        const res = await POST(requestPost());
        expect(res.status).toBe(401);
    });

    it("rechaza cuando el usuario no es ADMIN", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const res = await POST(requestPost());
        expect([401, 403]).toContain(res.status);
    });
});
