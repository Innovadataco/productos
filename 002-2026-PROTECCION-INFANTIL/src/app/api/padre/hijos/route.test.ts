/**
 * SPEC-339 (A-67 · T045/T074/T079) — POST/GET /api/padre/hijos.
 *
 * El tope vive en un PARÁMETRO (cambiarlo cambia el comportamiento sin
 * desplegar), y registrar un menor re-sella la cookie: el Paso 3 cierra al
 * instante.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    sellarCookieSesionEstado: vi.fn(),
}));

vi.mock("@/lib/routing/sellar-sesion-estado", () => ({
    sellarCookieSesionEstado: mocks.sellarCookieSesionEstado,
}));

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { POST, GET } from "./route";
import { PATCH } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

function reqCrear(body: unknown): Request {
    return new Request("http://localhost:5005/api/padre/hijos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function reqPatch(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
    return [
        new Request(`http://localhost:5005/api/padre/hijos/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
    ];
}

function menor(n: number) {
    return {
        nombre: `Menor ${n}`,
        apellidos: "De Prueba",
        documentoTipo: "TI",
        documentoNumero: `10300000${n}`,
    };
}

async function setTope(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.hijos.maximo" },
        update: { valor },
        create: { clave: "padre.hijos.maximo", valor, tipo: "INTEGER", categoria: "SYSTEM", descripcion: "tope test" },
    });
}

describe("POST /api/padre/hijos (SPEC-339)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        mocks.sellarCookieSesionEstado.mockResolvedValue(true);
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await setTope("5");
        await prisma.parametroSistema.upsert({
            where: { clave: "padre.hijos.maximo_mensaje" },
            update: {},
            create: {
                clave: "padre.hijos.maximo_mensaje",
                valor: "Puedes cuidar hasta {{maximo}} menores desde esta cuenta.",
                tipo: "STRING",
                categoria: "SYSTEM",
                descripcion: "mensaje test",
            },
        });
    });

    it("el 6º menor se rechaza con el mensaje del parámetro (número incluido)", async () => {
        for (let i = 1; i <= 5; i++) {
            expect((await POST(reqCrear(menor(i)))).status).toBe(201);
        }
        const res = await POST(reqCrear(menor(6)));
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toContain("hasta 5 menores");
    });

    it("cambiar el parámetro cambia el tope SIN desplegar (SC-005)", async () => {
        await setTope("2");
        expect((await POST(reqCrear(menor(1)))).status).toBe(201);
        expect((await POST(reqCrear(menor(2)))).status).toBe(201);
        const res = await POST(reqCrear(menor(3)));
        expect(res.status).toBe(409);
        expect((await res.json()).error.message).toContain("hasta 2 menores");
    });

    // T074: cerrar el Paso 3 al instante.
    it("registrar un menor RE-SELLA la cookie de estado en la misma respuesta", async () => {
        const res = await POST(reqCrear(menor(1)));
        expect(res.status).toBe(201);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledOnce();
    });

    // T079: el sellado fallido no es silencioso.
    it("SELLADO FALLIDO: el menor queda registrado y el padre recibe el aviso", async () => {
        mocks.sellarCookieSesionEstado.mockResolvedValue(false);
        const res = await POST(reqCrear(menor(1)));
        expect(res.status).toBe(201);
        expect((await res.json()).aviso).toContain("recárgala");
        expect(await prisma.hijo.count()).toBe(1);
    });

    it("apellidos ahora son obligatorios (FR-019)", async () => {
        const res = await POST(reqCrear({ nombre: "Sin", documentoTipo: "TI", documentoNumero: "999" }));
        expect(res.status).toBe(400);
    });
});

describe("PATCH /api/padre/hijos/[id] (SPEC-339 · FR-022)", { timeout: 60_000 }, () => {
    let padreId: string;

    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        mocks.sellarCookieSesionEstado.mockResolvedValue(true);
        const padre = await crearUsuario("PARENT");
        padreId = padre.id;
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await setTope("5");
    });

    async function crearMenor(n = 1) {
        const res = await POST(reqCrear(menor(n)));
        return (await res.json()).hijoId as string;
    }

    it("corrige nombre, apellidos y documento de un menor ya creado", async () => {
        const hijoId = await crearMenor();
        const [req, ctx] = reqPatch(hijoId, { apellidos: "Corregido", documentoNumero: "20400001" });
        const res = await PATCH(req, ctx);
        expect(res.status).toBe(200);
        const enBd = await prisma.hijo.findUnique({ where: { id: hijoId } });
        expect(enBd?.apellidos).toBe("Corregido");
        expect(enBd?.documentoNumero).toBe("20400001");
    });

    it("sigue aceptando { estado } solo — el consumidor viejo (MisHijos) no se rompe", async () => {
        const hijoId = await crearMenor();
        const [req, ctx] = reqPatch(hijoId, { estado: "inactivo" });
        const res = await PATCH(req, ctx);
        expect(res.status).toBe(200);
        expect((await prisma.hijo.findUnique({ where: { id: hijoId } }))?.estado).toBe("inactivo");
        // Cambiar el estado puede reabrir/cerrar el Paso 3 → re-sella.
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalled();
    });

    it("corregir el documento hacia uno ya usado en la propia lista → 409", async () => {
        await crearMenor(1);
        const hijo2 = await crearMenor(2);
        const [req, ctx] = reqPatch(hijo2, { documentoNumero: "103000001" });
        const res = await PATCH(req, ctx);
        expect(res.status).toBe(409);
    });

    it("el menor de OTRO padre → 404 (PII acceso-solo-dueño)", async () => {
        const otro = await crearUsuario("PARENT");
        const ajeno = await prisma.hijo.create({
            data: { usuarioId: otro.id, nombre: "Ajeno", apellidos: "X", documentoTipo: "TI", documentoNumero: "777" },
        });
        const [req, ctx] = reqPatch(ajeno.id, { nombre: "Robado" });
        const res = await PATCH(req, ctx);
        expect(res.status).toBe(404);
        expect(padreId).not.toBe(otro.id);
    });

    it("cuerpo vacío → 400", async () => {
        const hijoId = await crearMenor();
        const [req, ctx] = reqPatch(hijoId, {});
        expect((await PATCH(req, ctx)).status).toBe(400);
    });
});

describe("GET /api/padre/hijos", { timeout: 30_000 }, () => {
    it("lista solo los menores del padre autenticado", async () => {
        await resetDatabase();
        mocks.sellarCookieSesionEstado.mockResolvedValue(true);
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await setTope("5");
        await POST(reqCrear(menor(1)));
        await prisma.hijo.create({
            data: { usuarioId: otro.id, nombre: "Ajeno", apellidos: "X", documentoTipo: "TI", documentoNumero: "888" },
        });
        const res = await GET();
        const lista = await res.json();
        expect(lista).toHaveLength(1);
        expect(lista[0].nombre).toBe("Menor 1");
    });
});
