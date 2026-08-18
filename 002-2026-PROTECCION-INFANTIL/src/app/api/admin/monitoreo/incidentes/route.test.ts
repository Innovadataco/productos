import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/monitoreo/incidentes";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function sembrarIncidentes() {
    const t = Date.now();
    await prisma.incidenteInfra.createMany({
        data: [
            { senal: "app", estado: "ABIERTO", inicio: new Date(t - 3_000), detalle: "HTTP 500" },
            { senal: "bd", estado: "ABIERTO", inicio: new Date(t - 2_000), detalle: "connection refused" },
            { senal: "worker", estado: "RESUELTO", inicio: new Date(t - 1_000), fin: new Date(t - 500), detalle: "sin latido" },
        ],
    });
}

describe("GET /api/admin/monitoreo/incidentes (SPEC-171)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("403 con rol insuficiente", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("400 con query inválida (estado desconocido o pageSize>100)", async () => {
        await autenticarAdmin();

        const porEstado = await GET(new Request(`${URL}?estado=ROJO`));
        expect(porEstado.status).toBe(400);

        const porPageSize = await GET(new Request(`${URL}?pageSize=101`));
        expect(porPageSize.status).toBe(400);
    });

    it("devuelve items + pagination, más recientes primero", async () => {
        await autenticarAdmin();
        await sembrarIncidentes();

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.pagination).toEqual({ page: 1, pageSize: 25, total: 3, totalPages: 1 });
        expect(body.items).toHaveLength(3);
        expect(body.items.map((i: { senal: string }) => i.senal)).toEqual(["worker", "bd", "app"]);
    });

    it("filtra por estado=ABIERTO", async () => {
        await autenticarAdmin();
        await sembrarIncidentes();

        const res = await GET(new Request(`${URL}?estado=ABIERTO`));
        const body = await res.json();

        expect(body.pagination.total).toBe(2);
        expect(body.items.every((i: { estado: string }) => i.estado === "ABIERTO")).toBe(true);
    });

    it("pagina con page/pageSize", async () => {
        await autenticarAdmin();
        await sembrarIncidentes();

        const res = await GET(new Request(`${URL}?pageSize=2&page=2`));
        const body = await res.json();

        expect(body.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(body.items).toHaveLength(1);
        expect(body.items[0].senal).toBe("app");
    });
});
