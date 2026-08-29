import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearUsuario, crearColegioConAdmin, crearParametrosReportes } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { headers });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { colegio };
}

async function crearParametrosColegio() {
    await prisma.$executeRaw`
        INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
        VALUES
            (${crypto.randomUUID()}, ${"colegio.notificaciones.enabled"}, ${"true"}, ${"BOOLEAN"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW()),
            (${crypto.randomUUID()}, ${"colegio.notificaciones.cooldown_horas"}, ${"24"}, ${"INTEGER"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW())
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            "actualizadoEn" = NOW()
    `;
}

describe("GET /api/colegio/confianza/auditoria", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearParametrosColegio();
        mockToken = undefined;
    });

    it("devuelve eventos de auditoría del colegio de los últimos 90 días", async () => {
        const { colegio } = await setupSchoolAdmin();
        await prisma.auditLog.create({
            data: {
                accion: "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
                tipoRecurso: "InformeMensualColegio",
                colegioId: colegio.id,
                usuarioId: null,
                ipAddress: "sha256:abc",
                userAgent: "test",
                valorNuevo: JSON.stringify({ bytes: 100 }),
            },
        });

        const res = await GET(request("http://localhost:5005/api/colegio/confianza/auditoria", mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].accion).toBe("COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO");
        expect(json.pagination.total).toBe(1);
    });

    it("respeta el límite de días", async () => {
        const { colegio } = await setupSchoolAdmin();
        await prisma.auditLog.create({
            data: {
                accion: "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
                tipoRecurso: "InformeMensualColegio",
                colegioId: colegio.id,
                ipAddress: "sha256:abc",
                userAgent: "test",
                creadoEn: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
                valorNuevo: JSON.stringify({ bytes: 100 }),
            },
        });

        const res = await GET(request("http://localhost:5005/api/colegio/confianza/auditoria?dias=90", mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(0);
    });

    it("no expone eventos de otros colegios", async () => {
        await setupSchoolAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        await prisma.auditLog.create({
            data: {
                accion: "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
                tipoRecurso: "InformeMensualColegio",
                colegioId: otroColegio.id,
                ipAddress: "sha256:abc",
                userAgent: "test",
                valorNuevo: JSON.stringify({ bytes: 100 }),
            },
        });

        const res = await GET(request("http://localhost:5005/api/colegio/confianza/auditoria", mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(0);
    });

    it("ADMIN recibe 403", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(request("http://localhost:5005/api/colegio/confianza/auditoria", mockToken));
        expect(res.status).toBe(403);
    });
});
