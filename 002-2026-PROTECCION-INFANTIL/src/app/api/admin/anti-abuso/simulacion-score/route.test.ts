/**
 * SPEC-181 (Tarea C): integration del endpoint de simulación anti-abuso —
 * validación Zod (400), filtros q/nivel/plataformaId, orden cerrado y
 * paginación con convención `{ detalles, pagination }`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

const BASE = "http://localhost:5005/api/admin/anti-abuso/simulacion-score";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    activeToken = await crearTokenUsuario(admin.id, "ADMIN");
}

async function crearIdentificador({
    identificador,
    clavePlataforma = "whatsapp",
    nivelRiesgo = null,
    score = 0,
    ultimoReporteEn,
}: {
    identificador: string;
    clavePlataforma?: string;
    nivelRiesgo?: string | null;
    score?: number;
    ultimoReporteEn: Date;
}) {
    const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { clave: clavePlataforma } });
    return prisma.identificadorReportado.create({
        data: { identificador, plataformaId: plataforma.id, nivelRiesgo, score, ultimoReporteEn },
    });
}

async function getSimulacion(query: string) {
    const req = new Request(`${BASE}${query}`, {
        method: "GET",
        headers: { cookie: `token=${activeToken}` },
    });
    const res = await GET(req);
    return { status: res.status, body: await res.json() };
}

describe("GET /api/admin/anti-abuso/simulacion-score", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("rechaza q con menos de 3 caracteres (400 claro)", async () => {
        await autenticarAdmin();
        const { status, body } = await getSimulacion("?q=ab");
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("Parámetros inválidos");
    });

    it("rechaza un orden fuera del enum cerrado", async () => {
        await autenticarAdmin();
        const { status } = await getSimulacion("?orden=score;DROP");
        expect(status).toBe(400);
    });

    it("q filtra por identificador (contains, insensible a mayúsculas)", async () => {
        await autenticarAdmin();
        await crearIdentificador({ identificador: "Nick.Peligroso.XYZ", ultimoReporteEn: new Date("2026-07-20T00:00:00Z") });
        await crearIdentificador({ identificador: "+57300000111", ultimoReporteEn: new Date("2026-07-21T00:00:00Z") });

        const { status, body } = await getSimulacion(`?q=${encodeURIComponent("nick.peligroso")}`);
        expect(status).toBe(200);
        expect(body.detalles).toHaveLength(1);
        expect(body.detalles[0].identificador).toBe("Nick.Peligroso.XYZ");
        expect(body.pagination.total).toBe(1);
    });

    it("nivel filtra por el nivel de riesgo almacenado", async () => {
        await autenticarAdmin();
        await crearIdentificador({ identificador: "+57300000221", nivelRiesgo: "ALTO", ultimoReporteEn: new Date("2026-07-20T00:00:00Z") });
        await crearIdentificador({ identificador: "+57300000222", nivelRiesgo: "BAJO", ultimoReporteEn: new Date("2026-07-21T00:00:00Z") });

        const { status, body } = await getSimulacion("?nivel=ALTO");
        expect(status).toBe(200);
        expect(body.detalles).toHaveLength(1);
        expect(body.detalles[0].identificador).toBe("+57300000221");
    });

    it("plataformaId filtra por plataforma", async () => {
        await autenticarAdmin();
        await crearIdentificador({ identificador: "+57300000331", clavePlataforma: "whatsapp", ultimoReporteEn: new Date("2026-07-20T00:00:00Z") });
        await crearIdentificador({ identificador: "+57300000332", clavePlataforma: "instagram", ultimoReporteEn: new Date("2026-07-21T00:00:00Z") });
        const instagram = await prisma.plataforma.findUniqueOrThrow({ where: { clave: "instagram" } });

        const { status, body } = await getSimulacion(`?plataformaId=${instagram.id}`);
        expect(status).toBe(200);
        expect(body.detalles).toHaveLength(1);
        expect(body.detalles[0].identificador).toBe("+57300000332");
    });

    it("orden=antiguos invierte el default (recientes) y orden=score usa el score almacenado", async () => {
        await autenticarAdmin();
        await crearIdentificador({ identificador: "+57300000441", score: 10, ultimoReporteEn: new Date("2026-07-01T00:00:00Z") });
        await crearIdentificador({ identificador: "+57300000442", score: 90, ultimoReporteEn: new Date("2026-07-20T00:00:00Z") });

        const recientes = await getSimulacion("");
        expect(recientes.body.detalles.map((d: { identificador: string }) => d.identificador)).toEqual([
            "+57300000442",
            "+57300000441",
        ]);

        const antiguos = await getSimulacion("?orden=antiguos");
        expect(antiguos.body.detalles.map((d: { identificador: string }) => d.identificador)).toEqual([
            "+57300000441",
            "+57300000442",
        ]);

        const porScore = await getSimulacion("?orden=score");
        expect(porScore.body.detalles.map((d: { identificador: string }) => d.identificador)).toEqual([
            "+57300000442",
            "+57300000441",
        ]);
    });

    it("pagina con la convención pagination { page, pageSize, total, totalPages }", async () => {
        await autenticarAdmin();
        await crearIdentificador({ identificador: "+57300000551", ultimoReporteEn: new Date("2026-07-01T00:00:00Z") });
        await crearIdentificador({ identificador: "+57300000552", ultimoReporteEn: new Date("2026-07-20T00:00:00Z") });

        const { status, body } = await getSimulacion("?page=2&pageSize=1");
        expect(status).toBe(200);
        expect(body.pagination).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
        expect(body.detalles).toHaveLength(1);
        expect(body.detalles[0].identificador).toBe("+57300000551");
    });

    it("rechaza pageSize por encima del máximo", async () => {
        await autenticarAdmin();
        const { status } = await getSimulacion("?pageSize=500");
        expect(status).toBe(400);
    });
});
