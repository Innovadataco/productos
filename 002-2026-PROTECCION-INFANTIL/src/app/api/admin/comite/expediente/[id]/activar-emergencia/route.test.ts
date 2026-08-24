/**
 * SPEC-239 (002-PI-mega-cola): tests de integración de
 * POST /api/admin/comite/expediente/[id]/activar-emergencia (T012, US3):
 * éxito con contacto prioridad 1, fallback 2/3, sin contactos, no ROJO,
 * doble activación, control de rol y publicación del evento.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { programar } from "@/lib/notificaciones";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

function requestActivar(id: string) {
    return new Request(`http://localhost:5005/api/admin/comite/expediente/${id}/activar-emergencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
}

async function crearExpediente(padreId: string, overrides: Record<string, unknown> = {}) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57302${Math.floor(Math.random() * 1000000)}`,
            fechaApertura: new Date(),
            estado: "PENDIENTE_COMITE",
            numEventos: 3,
            scoreGravedadActual: "ROJO",
            ...overrides,
        } as never,
    });
}

async function crearContacto(padreId: string, prioridad: number, overrides: Record<string, unknown> = {}) {
    return prisma.contactoEmergencia.create({
        data: {
            padreUsuarioId: padreId,
            nombre: `Contacto P${prioridad}`,
            relacion: "MADRE",
            telefono: `+57300111111${prioridad}`,
            email: `contacto${prioridad}@example.com`,
            prioridad,
            ...overrides,
        } as never,
    });
}

describe("POST /api/admin/comite/expediente/[id]/activar-emergencia (SPEC-239)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        vi.clearAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: comité activa emergencia en expediente ROJO y notifica al contacto prioridad 1 (US3.1-US3.4)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);
        const contacto = await crearContacto(padre.id, 1);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.contacto.id).toBe(contacto.id);
        expect(json.notificacionProgramada).toBe(true);
        expect(json.eventoPublicado).toBe("expediente.emergencia.activada");
        expect(json.expediente.scoreGravedadActual).toBe("ROJO");
        expect(json.expediente.estado).toBe("PENDIENTE_COMITE");

        expect(programar).toHaveBeenCalledTimes(1);
        const input = vi.mocked(programar).mock.calls[0]![0];
        expect(input.evento).toBe("expediente.emergencia.activada");
        expect(input.destinatarios[0]?.email).toBe(contacto.email);
        expect(input.destinatarios[0]?.variables.contactoNombre).toBe(contacto.nombre);
        expect(input.destinatarios[0]?.variables.telefono).toBe(contacto.telefono);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_EMERGENCIA_ACTIVADA", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
        const metadatos = audit?.metadatos as Record<string, unknown>;
        expect(metadatos.activadorId).toBe(comite.id);
        expect(metadatos.contactoId).toBe(contacto.id);
    });

    it("200: fallback a prioridad 2 cuando la 1 está inactiva, auditado (US3.5/SC-003)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);
        await crearContacto(padre.id, 1, { activo: false });
        const contacto2 = await crearContacto(padre.id, 2);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.contacto.id).toBe(contacto2.id);

        const fallback = await prisma.auditLog.findFirst({
            where: { accion: "CONTACTO_EMERGENCIA_FALLBACK_USADO", recursoId: contacto2.id },
        });
        expect(fallback).not.toBeNull();
    });

    it("409: padre sin contactos activos audita EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS (SC-004)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("SIN_CONTACTOS_EMERGENCIA");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
        expect(programar).not.toHaveBeenCalled();
    });

    it("409: expediente no ROJO (SC-004)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id, { scoreGravedadActual: "AMARILLO" });
        await crearContacto(padre.id, 1);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("GRAVEDAD_NO_ROJO");
        expect(programar).not.toHaveBeenCalled();
    });

    it("409: doble activación dentro de la ventana de 5 minutos", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);
        await crearContacto(padre.id, 1);

        const primera = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(primera.status).toBe(200);
        const segunda = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(segunda.status).toBe(409);
        const json = await segunda.json();
        expect(json.error.code).toBe("EMERGENCIA_YA_ACTIVADA");
    });

    it("202: contacto prioritario sin email activa pero advierte (best-effort)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);
        await crearContacto(padre.id, 1, { email: null });

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(202);
        const json = await res.json();
        expect(json.notificacionProgramada).toBe(false);
        expect(json.advertencia).toBeTruthy();
        expect(programar).not.toHaveBeenCalled();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_EMERGENCIA_ACTIVADA", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
    });

    it("200: expediente ROJO fuera de estados vigilados queda en PENDIENTE_COMITE", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id, { estado: "ACTIVO" });
        await crearContacto(padre.id, 1);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.expediente.estado).toBe("PENDIENTE_COMITE");
    });

    it("403: ADMIN no puede activar emergencia (FR-005)", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const exp = await crearExpediente(padre.id);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(403);
    });

    it("403: PARENT no puede activar emergencia", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const exp = await crearExpediente(padre.id);

        const res = await POST(requestActivar(exp.id), { params: Promise.resolve({ id: exp.id }) });
        expect(res.status).toBe(403);
    });

    it("404: expediente inexistente", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await POST(requestActivar("no-existe"), { params: Promise.resolve({ id: "no-existe" }) });
        expect(res.status).toBe(404);
    });

    it("401: sin sesión", async () => {
        const res = await POST(requestActivar("cualquiera"), { params: Promise.resolve({ id: "cualquiera" }) });
        expect(res.status).toBe(401);
    });
});
