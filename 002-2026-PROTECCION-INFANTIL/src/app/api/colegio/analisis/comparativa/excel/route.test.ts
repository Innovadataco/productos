import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearPlataforma,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarAlertaColegio: vi.fn().mockResolvedValue(undefined),
}));

function request(url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { headers });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
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

describe("GET /api/colegio/analisis/comparativa/excel", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    it("descarga un Excel no vacío con content-type correcto", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        await crearEstudiante(curso.id, colegio.id, { nombre: "Ana" });

        const res = await GET(request("http://localhost:5005/api/colegio/analisis/comparativa/excel", mockToken));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        const contentDisposition = res.headers.get("content-disposition");
        expect(contentDisposition).toContain("comparativa-cursos-");
        expect(contentDisposition).toContain(".xlsx");

        const blob = await res.blob();
        expect(blob.size).toBeGreaterThan(0);
    });

    it("respeta el criterio de agrupación en el nombre del archivo", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto", anioLectivo: "2026" });

        const res = await GET(
            request("http://localhost:5005/api/colegio/analisis/comparativa/excel?agruparPor=anioLectivo", mockToken)
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-disposition")).toContain("anioLectivo");
    });

    it("ADMIN recibe 403", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(request("http://localhost:5005/api/colegio/analisis/comparativa/excel", mockToken));
        expect(res.status).toBe(403);
    });
});
