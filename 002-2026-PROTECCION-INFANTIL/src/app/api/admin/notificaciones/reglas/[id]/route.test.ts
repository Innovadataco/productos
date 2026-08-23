/**
 * SPEC-202 (002-PI-099): tests de integración del PATCH /api/admin/notificaciones/reglas/[id].
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const BASE_URL = "http://localhost:5005/api/admin/notificaciones/reglas";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function crearRegla(data: {
    evento?: string;
    rol?: string;
    offset?: string;
    canal?: "EMAIL" | "IN_APP";
    plantillaClave?: string;
    obligatoria?: boolean;
    activa?: boolean;
}) {
    return prisma.notificacionRegla.create({
        data: {
            evento: data.evento ?? "test.evento",
            rol: data.rol ?? "ADMIN",
            offset: data.offset ?? "+1h",
            canal: data.canal ?? "EMAIL",
            plantillaClave: data.plantillaClave ?? "test.plantilla",
            obligatoria: data.obligatoria ?? false,
            activa: data.activa ?? true,
        },
    });
}

function buildPatchRequest(id: string, body: unknown) {
    return new Request(`${BASE_URL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/admin/notificaciones/reglas/[id] (SPEC-202)", () => {
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
        const res = await PATCH(buildPatchRequest("cm00000000000000000000000", { activa: false }), {
            params: Promise.resolve({ id: "cm00000000000000000000000" }),
        });
        expect(res.status).toBe(401);
    });

    it("actualiza el canal de una regla", async () => {
        await autenticarAdmin();
        const regla = await crearRegla({ canal: "EMAIL" });

        const res = await PATCH(buildPatchRequest(regla.id, { canal: "IN_APP" }), {
            params: Promise.resolve({ id: regla.id }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.canal).toBe("IN_APP");
    });

    it("solicita confirmación al cambiar offset de regla activa", async () => {
        await autenticarAdmin();
        const regla = await crearRegla({ offset: "+1h", activa: true });
        await prisma.notificacion.create({
            data: {
                evento: regla.evento,
                destinatarioEmail: "test@example.com",
                plantillaClave: "test.plantilla",
                canal: "EMAIL",
                estado: "ENCOLADA",
                enviarEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
                variables: {},
            },
        });

        const res = await PATCH(buildPatchRequest(regla.id, { offset: "+2h" }), {
            params: Promise.resolve({ id: regla.id }),
        });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.requiereConfirmacion).toBe(true);
        expect(body.programadas).toBe(1);
    });

    it("recalcula programaciones cuando confirma cambio de offset", async () => {
        await autenticarAdmin();
        const regla = await crearRegla({ offset: "+1h", activa: true });
        await prisma.notificacion.create({
            data: {
                evento: regla.evento,
                destinatarioEmail: "test@example.com",
                plantillaClave: "test.plantilla",
                canal: "EMAIL",
                estado: "ENCOLADA",
                enviarEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
                variables: {},
            },
        });

        const res = await PATCH(buildPatchRequest(regla.id, { offset: "+2h", confirmRecalcular: true }), {
            params: Promise.resolve({ id: regla.id }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.offset).toBe("+2h");
        expect(typeof body.recalculadas).toBe("number");
    });

    it("devuelve 404 para id inexistente", async () => {
        await autenticarAdmin();
        const res = await PATCH(buildPatchRequest("cm00000000000000000000000", { activa: false }), {
            params: Promise.resolve({ id: "cm00000000000000000000000" }),
        });
        expect(res.status).toBe(404);
    });

    it("rechaza un offset con formato inválido", async () => {
        await autenticarAdmin();
        const regla = await crearRegla({ offset: "+1h" });

        const res = await PATCH(buildPatchRequest(regla.id, { offset: "mal" }), {
            params: Promise.resolve({ id: regla.id }),
        });
        expect(res.status).toBe(400);
    });
});
