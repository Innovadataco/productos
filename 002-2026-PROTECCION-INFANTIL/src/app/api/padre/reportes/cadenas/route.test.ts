/**
 * SPEC-340 (A-68 · T015) — cadenas para las tarjetas + evento con herencia +
 * el expediente de la cadena. FR-009 dedicado: el blindaje de ajenos.
 * SPEC-604: el expediente nace solo en el alta (el botón está derogado); el
 * endpoint POST /api/padre/expedientes queda como backfill idempotente.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";

let mockToken: string | undefined;
let hijoId: string;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { GET as getCadenas } from "./route";
import { POST as postEvento } from "../../../reportes/[id]/evento/route";
import { POST as postExpediente } from "../../expedientes/route";
import { POST as postReporte } from "../../../reportes/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

const TEXTO = "Un adulto insiste en pedirle fotos personales a una menor por el chat del juego cada noche.";

function reqReporte(identificador: string, reportePrevioId?: string): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify({
            identificador,
            plataforma: "whatsapp",
            texto: TEXTO,
            fechaIncidente: "2026-08-20T21:30:00Z",
            ciudad: "Bogotá",
            pais: "Colombia",
            // SPEC-591: el reporte autenticado del padre va atado a una ficha activa.
            hijoId,
            ...(reportePrevioId ? { reportePrevioId } : {}),
        }),
    });
}

function reqEvento(id: string, texto = "Volvió a escribirle desde otra cuenta nueva esta noche."): [Request, { params: Promise<{ id: string }> }] {
    return [
        new Request(`http://localhost:5005/api/reportes/${id}/evento`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({ texto, fechaIncidente: "2026-08-22T22:15:00Z" }),
        }),
        { params: Promise.resolve({ id }) },
    ];
}

function reqExpediente(reportePrincipalId: string): Request {
    return new Request("http://localhost:5005/api/padre/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify({ reportePrincipalId }),
    });
}

async function reportar(identificador: string, previo?: string): Promise<string> {
    const res = await postReporte(reqReporte(identificador, previo));
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(201);
    return body.reporte.id as string;
}

describe("SPEC-340 · el hilo de datos", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await resetRateLimitStore();
        const padre = await crearUsuario("PARENT", `hilo-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        // SPEC-591: el reporte autenticado del padre va atado a una ficha activa.
        const hijo = await prisma.hijo.create({
            data: { usuarioId: padre.id, nombre: "Valeria", apellidos: "Pérez", estado: "activo" },
        });
        hijoId = hijo.id;
    });

    it("agregar evento HEREDA los datos del principal en servidor y guarda la hora", async () => {
        const r1 = await reportar("+57300HILO01");
        const [req, ctx] = reqEvento(r1);
        const res = await postEvento(req, ctx);
        expect(res.status).toBe(201);
        const { reporte } = await res.json();

        const nuevo = await prisma.reporte.findUniqueOrThrow({ where: { id: reporte.id } });
        const principal = await prisma.reporte.findUniqueOrThrow({ where: { id: r1 } });
        expect(nuevo.reportePrincipalId, "queda enlazado a la cadena").toBe(r1);
        expect(nuevo.identificador).toBe(principal.identificador);
        expect(nuevo.ciudad).toBe(principal.ciudad);
        expect(nuevo.pais).toBe(principal.pais);
        // SPEC-604: la ficha del menor también se hereda del principal.
        expect(nuevo.hijoId).toBe(principal.hijoId);
        // La HORA del hecho se guarda (brief §2.2).
        expect(nuevo.fechaIncidente.toISOString()).toBe("2026-08-22T22:15:00.000Z");
    });

    it("el evento sobre un EVENTO se resuelve al principal (cadena plana)", async () => {
        const r1 = await reportar("+57300HILO02");
        const [reqA, ctxA] = reqEvento(r1);
        const resA = await postEvento(reqA, ctxA);
        const evento1 = (await resA.json()).reporte.id as string;

        const [reqB, ctxB] = reqEvento(evento1, "Ahora la amenaza con publicar las fotos si no responde.");
        const resB = await postEvento(reqB, ctxB);
        expect(resB.status).toBe(201);
        const evento2 = (await resB.json()).reporte.id as string;
        expect((await prisma.reporte.findUniqueOrThrow({ where: { id: evento2 } })).reportePrincipalId).toBe(r1);
    });

    it("cadena de 3 + un suelto → DOS tarjetas con contadores correctos y sin texto en el payload", async () => {
        const r1 = await reportar("+57300HILO03");
        const [qa, ca] = reqEvento(r1);
        await postEvento(qa, ca);
        const [qb, cb] = reqEvento(r1, "Le escribió otra vez de madrugada con insistencia y regalos.");
        await postEvento(qb, cb);
        await reportar("+57300SUELTO1");

        const res = await getCadenas();
        const { cadenas } = await res.json();
        expect(cadenas).toHaveLength(2);
        const cadena = cadenas.find((c: { cantidadEventos: number }) => c.cantidadEventos === 3);
        expect(cadena, "la cadena de 3 existe como una sola tarjeta").toBeTruthy();
        expect(cadena.eventos).toHaveLength(3);
        expect(cadena.eventos[0].esPrincipal).toBe(true);

        // EL TEXTO JAMÁS VIAJA en el listado (R-4).
        const crudo = JSON.stringify(cadenas);
        expect(crudo).not.toContain(TEXTO.slice(0, 30));
        expect(crudo).not.toContain("enc:");
    });

    it("FR-009: los ajenos llegan con fecha/lugar/clasificación, SIN texto y SIN autor, marcados", async () => {
        const r1 = await reportar("+57300HILO04");

        // Ajeno ANÓNIMO aprobado al mismo identificador.
        const plataforma = await prisma.plataforma.findFirstOrThrow();
        const ajenoBd = await crearReporteFixture(prisma, {
            data: {
                identificador: "+57300hilo04".toLowerCase(),
                plataformaId: plataforma.id,
                texto: "TEXTO-AJENO-QUE-JAMAS-VIAJA",
                fechaIncidente: new Date("2026-08-21T02:00:00Z"),
                ciudad: "Riohacha",
                pais: "Colombia",
                esAnonimo: true,
                estado: "CLASIFICADO",
                numeroSeguimiento: `AJ-${Date.now()}`,
            },
        });
        // El filtro de aprobados exige clasificación con categoría admitida.
        await prisma.clasificacionIA.create({
            data: {
                reporteId: ajenoBd.id,
                categoria: "OFRECIMIENTO_REGALOS",
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 500,
            },
        });

        const res = await getCadenas();
        const { cadenas } = await res.json();
        const cadena = cadenas.find((c: { reportePrincipalId: string }) => c.reportePrincipalId === r1);
        expect(cadena.otrosReportes.length).toBeGreaterThanOrEqual(1);
        const ajeno = cadena.otrosReportes[0];
        expect(ajeno.esAnonimo).toBe(true);
        expect(ajeno.ciudad).toBe("Riohacha");
        expect(JSON.stringify(cadena.otrosReportes)).not.toContain("TEXTO-AJENO");
        expect(JSON.stringify(ajeno)).not.toContain("usuarioId");
    });

    it("sin ajenos → lista vacía (la UI dice «sin otros reportes por ahora»)", async () => {
        const r1 = await reportar("+57300HILO05");
        const res = await getCadenas();
        const { cadenas } = await res.json();
        const cadena = cadenas.find((c: { reportePrincipalId: string }) => c.reportePrincipalId === r1);
        expect(cadena.otrosReportes).toEqual([]);
    });

    it("SPEC-604 · el expediente nace SOLO en el alta; el endpoint legado es idempotente y no duplica", async () => {
        const r1 = await reportar("+57300HILO06");

        // El primer reporte abrió el expediente (origen AUTOMATICO) con 1 evento.
        const expediente = await prisma.expediente.findFirstOrThrow();
        expect(expediente.origenCreacion).toBe("AUTOMATICO");
        expect(await prisma.eventoExpediente.count({ where: { expedienteId: expediente.id } })).toBe(1);

        // «Agregar otro evento» se suma al mismo expediente.
        const [qa, ca] = reqEvento(r1);
        await postEvento(qa, ca);
        expect(await prisma.eventoExpediente.count({ where: { expedienteId: expediente.id } })).toBe(2);
        expect((await prisma.expediente.findUniqueOrThrow({ where: { id: expediente.id } })).numEventos).toBe(2);

        // El endpoint legado (backfill de cadenas sin expediente) devuelve el
        // existente: ni duplica ni crea — dos toques, un solo expediente.
        const res1 = await postExpediente(reqExpediente(r1));
        expect(res1.status).toBe(200);
        expect((await res1.json()).expedienteId).toBe(expediente.id);
        const res2 = await postExpediente(reqExpediente(r1));
        expect(res2.status).toBe(200);
        expect(await prisma.expediente.count()).toBe(1);
    });

    it("SPEC-604 · el reporte de OTRO padre → 404; y la tarjeta trae «Ver expediente» desde el evento 1", async () => {
        const r1 = await reportar("+57300HILO07");
        const otro = await crearUsuario("PARENT", `otro-${Date.now()}@test.local`);
        const tokenPropio = mockToken;
        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        expect((await postExpediente(reqExpediente(r1))).status).toBe(404);
        mockToken = tokenPropio;

        // El expediente nació con el primer reporte: la tarjeta muestra «Ver».
        const res = await getCadenas();
        const cadena = (await res.json()).cadenas.find((c: { reportePrincipalId: string }) => c.reportePrincipalId === r1);
        expect(cadena.expedienteId, "toda cadena del padre tiene expediente desde el evento 1").not.toBeNull();
    });
});
