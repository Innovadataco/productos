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
                valor: "Tienes {{activos}} de {{maximo}} menores activos. Si quieres registrar otro, primero inactiva uno.",
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
        // SPEC-361 (A-70 · F5): el mensaje dice el cupo real y qué hacer.
        expect(json.error.message).toBe(
            "Tienes 5 de 5 menores activos. Si quieres registrar otro, primero inactiva uno.",
        );
    });

    it("cambiar el parámetro cambia el tope SIN desplegar (SC-005)", async () => {
        await setTope("2");
        expect((await POST(reqCrear(menor(1)))).status).toBe(201);
        expect((await POST(reqCrear(menor(2)))).status).toBe(201);
        const res = await POST(reqCrear(menor(3)));
        expect(res.status).toBe(409);
        expect((await res.json()).error.message).toContain("2 de 2 menores activos");
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

    // ── SPEC-361 (A-70 · F5 · F4 · F7) ──────────────────────────────────────
    it("F5: inactivar un menor LIBERA cupo — el tope cuenta solo activos", async () => {
        for (let i = 1; i <= 5; i++) {
            expect((await POST(reqCrear(menor(i)))).status).toBe(201);
        }
        expect((await POST(reqCrear(menor(6)))).status, "lleno").toBe(409);

        // El PADRE inactiva uno (el producto nunca lo hace por su cuenta).
        const hijos = await prisma.hijo.findMany({ select: { id: true } });
        await PATCH(...reqPatch(hijos[0]!.id, { estado: "inactivo" }));

        const res = await POST(reqCrear(menor(6)));
        expect(res.status, "el cupo liberado deja registrar otro").toBe(201);

        // Y el inactivo sigue existiendo: liberar cupo no es borrar.
        const total = await prisma.hijo.count();
        expect(total).toBe(6);
    });

    it("F5: el mensaje del tope nombra el cupo real y qué hacer", async () => {
        for (let i = 1; i <= 5; i++) await POST(reqCrear(menor(i)));
        const json = await (await POST(reqCrear(menor(6)))).json();
        expect(json.error.message).toBe(
            "Tienes 5 de 5 menores activos. Si quieres registrar otro, primero inactiva uno.",
        );
        // Nunca sugiere a cuál inactivar ni lo hace por su cuenta.
        expect(json.error.message).not.toMatch(/Menor \d/);
    });

    it("F7: el documento se valida por tipo — el caso de Jelkin (letras en una TI) se rechaza", async () => {
        const res = await POST(reqCrear({ ...menor(1), documentoTipo: "TI", documentoNumero: "84opkioniby" }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("solo números");
        expect(json.error.message).toContain("tarjeta de identidad");
        expect(await prisma.hijo.count(), "no se guardó nada").toBe(0);
    });

    it("F7: el pasaporte SÍ admite letras (no se valida todo con la misma regla)", async () => {
        const res = await POST(reqCrear({ ...menor(1), documentoTipo: "PASAPORTE", documentoNumero: "AV123456" }));
        expect(res.status).toBe(201);
    });

    it("F4: un campo faltante responde nombrando el campo, no 'Datos inválidos'", async () => {
        const res = await POST(reqCrear({ apellidos: "Sin Nombre", documentoTipo: "TI", documentoNumero: "1030999999" }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Escribe el nombre del menor.");
        expect(json.error.message).not.toBe("Datos inválidos");
    });

    it("apellidos ahora son obligatorios (FR-019)", async () => {
        const res = await POST(reqCrear({ nombre: "Sin", documentoTipo: "TI", documentoNumero: "999" }));
        expect(res.status).toBe(400);
    });

    it("SPEC-372 (A-74 P4 · I-262): un año fuera de rango por API directa se rechaza en el servidor", async () => {
        const anioActual = new Date().getFullYear();
        const fueraViejo = anioActual - 30; // 30 años, muy fuera del 5-17
        const res = await POST(
            reqCrear({
                ...menor(9),
                anioNacimiento: fueraViejo,
            })
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("entre 5 y 17");
        // Nada de fila creada en BD (el servidor cortó antes del DAL).
        const enBd = await prisma.hijo.findFirst({ where: { documentoNumero: "10300000" + 9 } });
        expect(enBd).toBeNull();
    });

    it("SPEC-372 (A-74 P4 · I-262): un año dentro del rango 5-17 sí queda registrado", async () => {
        const anioActual = new Date().getFullYear();
        const dentro = anioActual - 12; // 12 años, en el centro del rango
        const res = await POST(
            reqCrear({
                ...menor(10),
                anioNacimiento: dentro,
            })
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        const enBd = await prisma.hijo.findUnique({ where: { id: json.hijoId } });
        expect(enBd?.anioNacimiento).toBe(dentro);
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

    // Calidad (SPEC-342): el PATCH de inactivar con test PROPIO del re-sellado.
    it("inactivar re-sella (reabre el Paso 3) y reactivar también", async () => {
        const hijoId = await crearMenor();
        mocks.sellarCookieSesionEstado.mockClear();

        const [q1, c1] = reqPatch(hijoId, { estado: "inactivo" });
        expect((await PATCH(q1, c1)).status).toBe(200);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledTimes(1);

        const [q2, c2] = reqPatch(hijoId, { estado: "activo" });
        expect((await PATCH(q2, c2)).status).toBe(200);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledTimes(2);

        // Corregir SOLO datos (sin estado) NO re-sella: el paso no cambia.
        const [q3, c3] = reqPatch(hijoId, { apellidos: "Nuevo" });
        expect((await PATCH(q3, c3)).status).toBe(200);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledTimes(2);
    });

    it("cuerpo vacío → 400", async () => {
        const hijoId = await crearMenor();
        const [req, ctx] = reqPatch(hijoId, {});
        expect((await PATCH(req, ctx)).status).toBe(400);
    });

    it("SPEC-372 (A-74 P4 · I-262): corregir el año hacia uno fuera de rango → 400 y la fila no cambia", async () => {
        const hijoId = await crearMenor();
        const anioActual = new Date().getFullYear();
        const fuera = anioActual - 30;
        const antes = await prisma.hijo.findUnique({ where: { id: hijoId } });
        const [req, ctx] = reqPatch(hijoId, { anioNacimiento: fuera });
        const res = await PATCH(req, ctx);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("entre 5 y 17");
        const despues = await prisma.hijo.findUnique({ where: { id: hijoId } });
        expect(despues?.anioNacimiento).toBe(antes?.anioNacimiento);
    });

    // ── SPEC-363 · BUG1: el cupo NO es burlable al reactivar ─────────────────
    it("BUG1: reactivar un menor con el cupo lleno → 409 con el texto aprobado", async () => {
        // 5 activos (tope). El padre inactiva 1 y registra el 6º (queda 5 activos
        // + 1 inactivo). Reactivar el inactivo daría 6 activos: debe rebotar.
        const ids: string[] = [];
        for (let i = 1; i <= 5; i++) ids.push(await crearMenor(i));
        await PATCH(...reqPatch(ids[0]!, { estado: "inactivo" }));
        expect((await POST(reqCrear(menor(6)))).status, "el 6º entra porque hay 4 activos").toBe(201);

        const [req, ctx] = reqPatch(ids[0]!, { estado: "activo" });
        const res = await PATCH(req, ctx);
        expect(res.status, "reactivar sería el 6º activo").toBe(409);
        const json = await res.json();
        expect(json.error.message).toBe(
            "Tienes 5 de 5 menores activos. Si quieres registrar otro, primero inactiva uno.",
        );
        // El menor sigue inactivo: el rebote no lo dejó a medias.
        expect((await prisma.hijo.findUnique({ where: { id: ids[0]! } }))?.estado).toBe("inactivo");
    });

    it("BUG1: reactivar con cupo disponible SÍ funciona; reafirmar 'activo' sobre uno activo no consume cupo", async () => {
        const a = await crearMenor(1);
        const b = await crearMenor(2);
        await PATCH(...reqPatch(a, { estado: "inactivo" }));
        // 1 activo (b), tope 5 → reactivar a queda holgado.
        expect((await PATCH(...reqPatch(a, { estado: "activo" }))).status).toBe(200);
        // Reafirmar activo sobre uno ya activo no debe contar ni rebotar.
        expect((await PATCH(...reqPatch(b, { estado: "activo" }))).status).toBe(200);
    });

    // ── SPEC-363 · BUG2: el PATCH de estado audita {estado} para la bitácora ──
    it("BUG2: pausar/reactivar por la ruta real audita {estado} con el VALOR (no {campos})", async () => {
        const hijoId = await crearMenor();

        await PATCH(...reqPatch(hijoId, { estado: "inactivo" }));
        await PATCH(...reqPatch(hijoId, { estado: "activo" }));

        const audits = await prisma.auditLog.findMany({
            where: { accion: "HIJO_UPDATE", recursoId: hijoId },
            orderBy: { creadoEn: "asc" },
        });
        const valores = audits.map((a) => JSON.parse(a.valorNuevo ?? "{}"));
        // La bitácora lee `valorNuevo.estado`: tiene que estar el valor, no un
        // `{campos:["estado"]}` que la deja sin hito.
        expect(valores).toContainEqual({ estado: "inactivo" });
        expect(valores).toContainEqual({ estado: "activo" });
        expect(valores.some((v) => Array.isArray(v.campos)), "no audita por 'campos' el cambio de estado").toBe(false);
    });

    it("BUG2: un PATCH mixto (datos + estado) corrige los datos Y audita el estado con valor", async () => {
        const hijoId = await crearMenor();
        const [req, ctx] = reqPatch(hijoId, { apellidos: "Corregido", estado: "inactivo" });
        expect((await PATCH(req, ctx)).status).toBe(200);

        const enBd = await prisma.hijo.findUnique({ where: { id: hijoId } });
        expect(enBd?.apellidos).toBe("Corregido");
        expect(enBd?.estado).toBe("inactivo");

        const valores = (
            await prisma.auditLog.findMany({ where: { accion: "HIJO_UPDATE", recursoId: hijoId } })
        ).map((a) => JSON.parse(a.valorNuevo ?? "{}"));
        expect(valores).toContainEqual({ estado: "inactivo" });
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
