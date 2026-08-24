/**
 * SPEC-239 (002-PI-mega-cola): tests de integración de
 * GET/POST /api/padre/contacto-emergencia (T016, US1): creación con E.164,
 * listado ordenado por prioridad, validación 400 y anti cross-user leak.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function requestLista(query = "") {
    return new Request(`http://localhost:5005/api/padre/contacto-emergencia${query}`, { method: "GET" });
}

function requestCrear(body: unknown) {
    return new Request("http://localhost:5005/api/padre/contacto-emergencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const contactoValido = {
    nombre: "María García",
    relacion: "MADRE",
    telefono: "+573001234567",
    email: "maria@example.com",
    prioridad: 1,
};

describe("/api/padre/contacto-emergencia (SPEC-239)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("201: crea contacto y audita CONTACTO_EMERGENCIA_CREADO (US1.1)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestCrear(contactoValido));
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.contacto.telefono).toBe("+573001234567");
        expect(json.contacto.activo).toBe(true);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "CONTACTO_EMERGENCIA_CREADO", recursoId: json.contacto.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(padre.id);
    });

    it("400: teléfono sin formato E.164 no toca la BD (US1.6)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestCrear({ ...contactoValido, telefono: "3001234567" }));
        expect(res.status).toBe(400);
        expect(await prisma.contactoEmergencia.count()).toBe(0);
    });

    it("400: prioridad fuera de 1..3", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(requestCrear({ ...contactoValido, prioridad: 5 }));
        expect(res.status).toBe(400);
    });

    it("200: lista solo los contactos propios ordenados por prioridad ASC (US1.4/SC-001)", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await prisma.contactoEmergencia.create({
            data: { padreUsuarioId: padre.id, nombre: "P2", relacion: "PADRE", telefono: "+573001111112", prioridad: 2 },
        });
        await prisma.contactoEmergencia.create({
            data: { padreUsuarioId: padre.id, nombre: "P1", relacion: "MADRE", telefono: "+573001111111", prioridad: 1 },
        });
        await prisma.contactoEmergencia.create({
            data: { padreUsuarioId: otro.id, nombre: "Ajeno", relacion: "TUTOR", telefono: "+573001111113", prioridad: 1 },
        });

        const res = await GET(requestLista());
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.map((c: { nombre: string }) => c.nombre)).toEqual(["P1", "P2"]);
        expect(json.pagination.total).toBe(2);
    });

    it("200: por defecto excluye inactivos; incluirInactivos=true los trae (US1.3)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await prisma.contactoEmergencia.create({
            data: { padreUsuarioId: padre.id, nombre: "Activo", relacion: "MADRE", telefono: "+573001111111", prioridad: 1 },
        });
        await prisma.contactoEmergencia.create({
            data: { padreUsuarioId: padre.id, nombre: "Inactivo", relacion: "PADRE", telefono: "+573001111112", prioridad: 2, activo: false },
        });

        const soloActivos = await (await GET(requestLista())).json();
        expect(soloActivos.items).toHaveLength(1);

        const todos = await (await GET(requestLista("?incluirInactivos=true"))).json();
        expect(todos.items).toHaveLength(2);
    });

    it("403: un rol distinto de PARENT no puede usar el CRUD", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        expect((await POST(requestCrear(contactoValido))).status).toBe(403);
        expect((await GET(requestLista())).status).toBe(403);
    });

    it("401: sin sesión", async () => {
        expect((await GET(requestLista())).status).toBe(401);
    });
});
