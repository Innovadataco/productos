/**
 * SPEC-202 (002-PI-099): tests de integración del GET /api/admin/notificaciones/parametros.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/notificaciones/parametros";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearParametro(data: { clave: string; valor?: string; tipo?: string; categoria?: string }) {
    return prisma.parametroSistema.create({
        data: {
            clave: data.clave,
            valor: data.valor ?? "valor",
            tipo: (data.tipo ?? "STRING") as never,
            categoria: (data.categoria ?? "SYSTEM") as never,
            esPublico: false,
        },
    });
}

describe("GET /api/admin/notificaciones/parametros (SPEC-202)", () => {
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

    it("devuelve solo parámetros cuya clave comienza con notificaciones.", async () => {
        await autenticarAdmin();
        await crearParametro({ clave: "notificaciones.worker.intervalo_segundos", valor: "10" });
        await crearParametro({ clave: "reportes.otro.valor", valor: "20" });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].clave).toBe("notificaciones.worker.intervalo_segundos");
    });

    it("devuelve lista vacía cuando no hay parámetros del motor", async () => {
        await autenticarAdmin();
        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(0);
    });
});
