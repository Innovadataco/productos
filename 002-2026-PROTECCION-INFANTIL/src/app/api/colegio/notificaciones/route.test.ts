/**
 * SPEC-169 (Fase G): tests de los endpoints de notificaciones in-app.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as listar } from "./route";
import { GET as resumen } from "./resumen/route";
import { PATCH as marcarLeidas } from "./marcar-leidas/route";
import { PATCH as marcarUna, DELETE as archivarUna } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, body?: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function crearNotificacion(colegioId: string, usuarioId: string, tipo = "ALERTA_NUEVA" as const) {
    return prisma.notificacionInApp.create({
        data: {
            colegioId,
            usuarioId,
            tipo,
            titulo: "Título",
            mensaje: "Mensaje",
        },
    });
}

describe("/api/colegio/notificaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET lista notificaciones no archivadas paginadas", async () => {
        const { colegio, admin } = await setupSchoolAdmin();
        await crearNotificacion(colegio.id, admin.id);
        await crearNotificacion(colegio.id, admin.id);

        const res = await listar(request("GET", "http://localhost:5005/api/colegio/notificaciones", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.total).toBe(2);
    });

    it("GET /resumen devuelve el conteo de no leídas", async () => {
        const { colegio, admin } = await setupSchoolAdmin();
        await crearNotificacion(colegio.id, admin.id);
        const leida = await crearNotificacion(colegio.id, admin.id);
        await prisma.notificacionInApp.update({ where: { id: leida.id }, data: { leidaEn: new Date() } });

        const res = await resumen(request("GET", "http://localhost:5005/api/colegio/notificaciones/resumen", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.noLeidas).toBe(1);
    });

    it("PATCH /marcar-leidas marca todas como leídas", async () => {
        const { colegio, admin } = await setupSchoolAdmin();
        await crearNotificacion(colegio.id, admin.id);
        await crearNotificacion(colegio.id, admin.id);

        const res = await marcarLeidas(
            request("PATCH", "http://localhost:5005/api/colegio/notificaciones/marcar-leidas", {}, mockToken)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.afectadas).toBe(2);
        expect(await prisma.notificacionInApp.count({ where: { colegioId: colegio.id, leidaEn: null } })).toBe(0);
    });

    it("PATCH /[id] marca una notificación como leída", async () => {
        const { colegio, admin } = await setupSchoolAdmin();
        const notificacion = await crearNotificacion(colegio.id, admin.id);

        const res = await marcarUna(
            request("PATCH", `http://localhost:5005/api/colegio/notificaciones/${notificacion.id}`, {}, mockToken),
            { params: Promise.resolve({ id: notificacion.id }) }
        );
        expect(res.status).toBe(200);
        const actualizada = await prisma.notificacionInApp.findUnique({ where: { id: notificacion.id } });
        expect(actualizada?.leidaEn).not.toBeNull();
    });

    it("DELETE /[id] archiva una notificación", async () => {
        const { colegio, admin } = await setupSchoolAdmin();
        const notificacion = await crearNotificacion(colegio.id, admin.id);

        const res = await archivarUna(
            request("DELETE", `http://localhost:5005/api/colegio/notificaciones/${notificacion.id}`, undefined, mockToken),
            { params: Promise.resolve({ id: notificacion.id }) }
        );
        expect(res.status).toBe(200);
        const actualizada = await prisma.notificacionInApp.findUnique({ where: { id: notificacion.id } });
        expect(actualizada?.archivadaEn).not.toBeNull();
    });

    it("A/B: un colegio no ve ni archiva notificaciones de otro colegio", async () => {
        const { colegio: a, admin: adminA } = await setupSchoolAdmin();
        const { colegio: b, admin: adminB } = await crearColegioConAdmin();
        const notifB = await crearNotificacion(b.id, adminB.id);

        mockToken = await crearTokenUsuario(adminA.id, "SCHOOL_ADMIN");
        const res = await archivarUna(
            request("DELETE", `http://localhost:5005/api/colegio/notificaciones/${notifB.id}`, undefined, mockToken),
            { params: Promise.resolve({ id: notifB.id }) }
        );
        expect(res.status).toBe(404);

        const intacta = await prisma.notificacionInApp.findUnique({ where: { id: notifB.id } });
        expect(intacta?.archivadaEn).toBeNull();
    });

    it("sin sesión devuelve 401", async () => {
        await setupSchoolAdmin();
        mockToken = undefined;
        const res = await listar(request("GET", "http://localhost:5005/api/colegio/notificaciones"));
        expect(res.status).toBe(401);
    });
});
