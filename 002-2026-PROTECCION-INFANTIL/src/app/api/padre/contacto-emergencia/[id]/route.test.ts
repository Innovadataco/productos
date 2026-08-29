/**
 * SPEC-239 (002-PI-mega-cola): tests de integración de
 * PATCH/DELETE /api/padre/contacto-emergencia/[id] (T016, US1): actualización
 * de campos permitidos, baja lógica y 404 cross-user (SC-001).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import type { ContactoEmergencia } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function requestPatch(id: string, body: unknown) {
    return new Request(`http://localhost:5005/api/padre/contacto-emergencia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function requestDelete(id: string) {
    return new Request(`http://localhost:5005/api/padre/contacto-emergencia/${id}`, { method: "DELETE" });
}

async function crearContacto(padreId: string, overrides: Record<string, unknown> = {}): Promise<ContactoEmergencia> {
    return prisma.contactoEmergencia.create({
        data: {
            padreUsuarioId: padreId,
            nombre: "María García",
            relacion: "MADRE",
            telefono: "+573001234567",
            prioridad: 1,
            ...overrides,
        } as never,
    });
}

describe("/api/padre/contacto-emergencia/[id] (SPEC-239)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: PATCH actualiza campos permitidos y audita (US1.2)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const contacto = await crearContacto(padre.id);

        const res = await PATCH(requestPatch(contacto.id, { telefono: "+573009876543", prioridad: 2 }), {
            params: Promise.resolve({ id: contacto.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.contacto.telefono).toBe("+573009876543");
        expect(json.contacto.prioridad).toBe(2);
        expect(json.contacto.nombre).toBe("María García");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "CONTACTO_EMERGENCIA_ACTUALIZADO", recursoId: contacto.id },
        });
        expect(audit).not.toBeNull();
    });

    it("200: PATCH con activo=false lo saca de las lecturas de activos pero conserva la fila (US1.3)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const contacto = await crearContacto(padre.id);

        const res = await PATCH(requestPatch(contacto.id, { activo: false }), {
            params: Promise.resolve({ id: contacto.id }),
        });
        expect(res.status).toBe(200);

        const conservado = await prisma.contactoEmergencia.findUnique({ where: { id: contacto.id } });
        expect(conservado).not.toBeNull();
        expect(conservado?.activo).toBe(false);
    });

    it("400: PATCH con teléfono inválido (US1.6)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const contacto = await crearContacto(padre.id);

        const res = await PATCH(requestPatch(contacto.id, { telefono: "123" }), {
            params: Promise.resolve({ id: contacto.id }),
        });
        expect(res.status).toBe(400);
        const sinCambio = await prisma.contactoEmergencia.findUnique({ where: { id: contacto.id } });
        expect(sinCambio?.telefono).toBe("+573001234567");
    });

    it("404: PATCH/DELETE sobre contacto de otro padre sin tocar nada (US1.5)", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        const contacto = await crearContacto(padre.id);

        const resPatch = await PATCH(requestPatch(contacto.id, { nombre: "Hackeado" }), {
            params: Promise.resolve({ id: contacto.id }),
        });
        expect(resPatch.status).toBe(404);

        const resDelete = await DELETE(requestDelete(contacto.id), {
            params: Promise.resolve({ id: contacto.id }),
        });
        expect(resDelete.status).toBe(404);

        const intacto = await prisma.contactoEmergencia.findUnique({ where: { id: contacto.id } });
        expect(intacto?.nombre).toBe("María García");
        expect(intacto?.activo).toBe(true);
    });

    it("200: DELETE hace baja lógica y audita CONTACTO_EMERGENCIA_ELIMINADO (D3)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const contacto = await crearContacto(padre.id);

        const res = await DELETE(requestDelete(contacto.id), { params: Promise.resolve({ id: contacto.id }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.eliminado).toBe(true);

        const conservado = await prisma.contactoEmergencia.findUnique({ where: { id: contacto.id } });
        expect(conservado).not.toBeNull();
        expect(conservado?.activo).toBe(false);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "CONTACTO_EMERGENCIA_ELIMINADO", recursoId: contacto.id },
        });
        expect(audit).not.toBeNull();
    });
});
