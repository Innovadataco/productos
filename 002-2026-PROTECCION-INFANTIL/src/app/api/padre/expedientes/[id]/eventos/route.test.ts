/**
 * SPEC-232 (002-PI-132): tests de integración de POST /api/padre/expedientes/[id]/eventos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { prisma } from "@/lib/prisma";
import { RolUsuario, EstadoExpediente } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            if ((name === "token" || name === "__Host-token") && mockToken) {
                return { name, value: mockToken };
            }
            return undefined;
        },
    }),
}));

function crearRequest(body: unknown, expedienteId: string, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(`http://localhost:5005/api/padre/expedientes/${expedienteId}/eventos`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function seedExpediente(padreId: string, estado: EstadoExpediente = EstadoExpediente.ACTIVO) {
    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: `@test-${Date.now()}`,
        plataformaId: "instagram",
    });
    if (estado !== EstadoExpediente.ACTIVO) {
        await prisma.expediente.update({
            where: { id: expediente.id },
            data: { estado },
        });
    }
    return expediente;
}

describe("POST /api/padre/expedientes/[id]/eventos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea evento y reporte asociado para expediente propio activo (201)", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-exp-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);
        const expediente = await seedExpediente(padre.id);

        const req = crearRequest(
            { texto: "Nueva situación de prueba", plataforma: "Instagram" },
            expediente.id,
            mockToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.evento.ordenSecuencial).toBe(1);
        expect(json.evento.texto).toBe("Nueva situación de prueba");

        const repo = new ExpedienteRepository();
        const actualizado = await repo.obtenerExpedientePorId(expediente.id, padre.id);
        expect(actualizado?.numEventos).toBe(1);
        expect(actualizado?.eventos).toHaveLength(1);
        expect(actualizado?.eventos[0].reporteId).not.toBeNull();
    });

    it("devuelve 404 si el expediente no pertenece al padre", async () => {
        const padreA = await crearUsuario(RolUsuario.PARENT, `padre-a-${Date.now()}@test.co`);
        const padreB = await crearUsuario(RolUsuario.PARENT, `padre-b-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padreB.id, RolUsuario.PARENT);
        const expedienteA = await seedExpediente(padreA.id);

        const req = crearRequest({ texto: "Intento de intrusión" }, expedienteA.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: expedienteA.id }) });

        expect(res.status).toBe(404);
    });

    it("devuelve 409 si el expediente está cerrado", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-cerrado-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);
        const expediente = await seedExpediente(padre.id, EstadoExpediente.CERRADO);

        const req = crearRequest({ texto: "Evento sobre cerrado" }, expediente.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(409);
    });

    it("devuelve 400 si el texto supera 2000 caracteres", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-largo-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);
        const expediente = await seedExpediente(padre.id);

        const req = crearRequest({ texto: "x".repeat(2001) }, expediente.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(400);
    });

    it("devuelve 401 sin token", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sin-${Date.now()}@test.co`);
        const expediente = await seedExpediente(padre.id);

        const req = crearRequest({ texto: "Sin auth" }, expediente.id);
        const res = await POST(req, { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(401);
    });

    it("devuelve 403 si el rol no es PARENT", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-exp-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-rol-${Date.now()}@test.co`);
        const expediente = await seedExpediente(padre.id);

        const req = crearRequest({ texto: "Admin intentando" }, expediente.id, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(403);
    });
});
