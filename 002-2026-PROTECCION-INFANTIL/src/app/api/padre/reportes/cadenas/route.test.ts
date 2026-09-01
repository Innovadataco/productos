/**
 * SPEC-340 (A-68 · T015) — cadenas para las tarjetas + evento con herencia +
 * el botón del expediente. FR-009 dedicado: el blindaje de ajenos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let mockToken: string | undefined;
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
        const ajenoBd = await prisma.reporte.create({
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

    it("T016 · el botón crea el expediente UNA vez (idempotente) DESDE la cadena, origen PADRE", async () => {
        const r1 = await reportar("+57300HILO06");
        const [qa, ca] = reqEvento(r1);
        await postEvento(qa, ca);

        const res1 = await postExpediente(reqExpediente(r1));
        expect(res1.status).toBe(201);
        const { expedienteId } = await res1.json();

        const exp = await prisma.expediente.findUniqueOrThrow({ where: { id: expedienteId } });
        expect(exp.origenCreacion).toBe("PADRE");
        // Los eventos del expediente se armaron DESDE la cadena (2 reportes).
        expect(await prisma.eventoExpediente.count({ where: { expedienteId } })).toBe(2);

        // Idempotencia: segundo toque devuelve el mismo.
        const res2 = await postExpediente(reqExpediente(r1));
        expect(res2.status).toBe(200);
        expect((await res2.json()).expedienteId).toBe(expedienteId);
        expect(await prisma.expediente.count()).toBe(1);
    });

    it("T016 · el reporte de OTRO padre → 404; y la tarjeta refleja Crear/Ver según exista", async () => {
        const r1 = await reportar("+57300HILO07");
        const otro = await crearUsuario("PARENT", `otro-${Date.now()}@test.local`);
        const tokenPropio = mockToken;
        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        expect((await postExpediente(reqExpediente(r1))).status).toBe(404);
        mockToken = tokenPropio;

        let res = await getCadenas();
        let cadena = (await res.json()).cadenas.find((c: { reportePrincipalId: string }) => c.reportePrincipalId === r1);
        expect(cadena.expedienteId, "sin expediente → botón Crear").toBeNull();

        await postExpediente(reqExpediente(r1));
        res = await getCadenas();
        cadena = (await res.json()).cadenas.find((c: { reportePrincipalId: string }) => c.reportePrincipalId === r1);
        expect(cadena.expedienteId, "con expediente → botón Ver").not.toBeNull();
    });
});
