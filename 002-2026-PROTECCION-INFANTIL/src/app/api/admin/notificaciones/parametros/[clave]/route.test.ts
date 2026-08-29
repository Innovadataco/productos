/**
 * SPEC-202 (002-PI-099): tests de integración del PATCH /api/admin/notificaciones/parametros/[clave].
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const BASE_URL = "http://localhost:5005/api/admin/notificaciones/parametros";

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

function buildPatchRequest(clave: string, body: unknown) {
    return new Request(`${BASE_URL}/${encodeURIComponent(clave)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/admin/notificaciones/parametros/[clave] (SPEC-202)", () => {
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
        const res = await PATCH(buildPatchRequest("notificaciones.test", { valor: "x" }), {
            params: Promise.resolve({ clave: "notificaciones.test" }),
        });
        expect(res.status).toBe(401);
    });

    it("actualiza el valor de un parámetro existente", async () => {
        await autenticarAdmin();
        await crearParametro({ clave: "notificaciones.worker.intervalo_segundos", valor: "10", tipo: "INTEGER" });

        const res = await PATCH(
            buildPatchRequest("notificaciones.worker.intervalo_segundos", { valor: "20" }),
            { params: Promise.resolve({ clave: "notificaciones.worker.intervalo_segundos" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.valor).toBe("20");

        const actualizado = await prisma.parametroSistema.findUnique({
            where: { clave: "notificaciones.worker.intervalo_segundos" },
        });
        expect(actualizado?.valor).toBe("20");
    });

    it("rechaza actualizar un parámetro inexistente", async () => {
        await autenticarAdmin();
        const res = await PATCH(buildPatchRequest("notificaciones.inexistente", { valor: "20" }), {
            params: Promise.resolve({ clave: "notificaciones.inexistente" }),
        });
        expect(res.status).toBe(404);
    });

    it("rechaza un valor vacío", async () => {
        await autenticarAdmin();
        await crearParametro({ clave: "notificaciones.test", valor: "10" });

        const res = await PATCH(buildPatchRequest("notificaciones.test", { valor: "" }), {
            params: Promise.resolve({ clave: "notificaciones.test" }),
        });
        expect(res.status).toBe(400);
    });
});
