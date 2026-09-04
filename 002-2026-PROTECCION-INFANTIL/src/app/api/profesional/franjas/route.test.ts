/**
 * SPEC-447 (I-311) · las franjas del profesional, contra la BD.
 *
 * Candados de CONDUCTA: cada uno pega en el endpoint que dispara la pantalla y
 * afirma **la fila en base**, no el texto del código. La ruta existía desde
 * SPEC-395 y nunca se había ejercitado de punta a punta porque no había
 * pantalla que la llamara — en producción `FranjaDisponible` tuvo 0 filas.
 *
 * Dos de las cuatro validaciones que se prueban acá **no existían** antes de
 * esta spec: el solape y la modalidad que el profesional no atiende.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { instanteDesdeHoraBogota, sumarMinutos } from "@/lib/fechas/formato-bogota";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { POST, GET } from "./route";
import { DELETE } from "./[id]/route";

const DIA = "2027-03-10";

async function sembrarProfesional(opciones: { virtual?: boolean; presencial?: boolean } = {}) {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad =
        (await prisma.ciudad.findFirst({ where: { paisId: pais.id } })) ??
        (await prisma.ciudad.create({
            data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id },
        }));
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
    mockToken = await crearTokenUsuario(usuario.id, "PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Mariana Restrepo",
            tituloProfesional: "Psicología",
            especialidades: ["infantil"],
            ciudadId: ciudad.id,
            aniosExperiencia: 8,
            presentacion: "Presentación.",
            tarifaConsultaCOP: 180000,
            duracionMinutos: 45,
            atiendeVirtual: opciones.virtual ?? true,
            atiendePresencial: opciones.presencial ?? false,
            estado: "ACTIVO",
        },
    });
    return { usuario, perfil };
}

/** El mismo cuerpo que arma la pantalla: día y hora de Bogotá + duración del perfil. */
function cuerpo(hora: string, modalidad: "VIRTUAL" | "PRESENCIAL" = "VIRTUAL", minutos = 45) {
    const inicio = instanteDesdeHoraBogota(DIA, hora);
    return {
        inicio: inicio.toISOString(),
        fin: sumarMinutos(inicio, minutos).toISOString(),
        modalidad,
    };
}

function req(body: unknown) {
    return new Request("http://localhost:5005/api/profesional/franjas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/profesional/franjas · SPEC-447 (I-311)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("publica la franja y la fila QUEDA en base, libre y a la hora de Bogotá", async () => {
        const { perfil } = await sembrarProfesional();

        const res = await POST(req(cuerpo("10:00")));
        expect(res.status).toBe(200);

        const filas = await prisma.franjaDisponible.findMany({ where: { profesionalId: perfil.id } });
        expect(filas).toHaveLength(1);
        // 10:00 en Bogotá = 15:00 UTC. Si esto se rompe, la agenda se corre
        // cinco horas y el padre reserva a una hora que nadie prometió.
        expect(filas[0]!.inicio.toISOString()).toBe("2027-03-10T15:00:00.000Z");
        expect(filas[0]!.fin.toISOString()).toBe("2027-03-10T15:45:00.000Z");
        expect(filas[0]!.tomada).toBe(false);
    });

    it("y el GET se la devuelve al profesional", async () => {
        await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data).toHaveLength(1);
    });

    it("contraprueba · un rango invertido se rechaza y NO deja fila", async () => {
        const { perfil } = await sembrarProfesional();
        const inicio = instanteDesdeHoraBogota(DIA, "10:00");

        const res = await POST(
            req({
                inicio: inicio.toISOString(),
                fin: sumarMinutos(inicio, -45).toISOString(),
                modalidad: "VIRTUAL",
            }),
        );

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("contraprueba · una franja que se PISA con otra se rechaza", async () => {
        const { perfil } = await sembrarProfesional();
        expect((await POST(req(cuerpo("10:00")))).status).toBe(200);

        // Empieza dentro de la anterior (10:00–10:45).
        const res = await POST(req(cuerpo("10:30")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(1);
    });

    it("pegada a la anterior SÍ se puede: 10:45 arranca donde la otra termina", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const res = await POST(req(cuerpo("10:45")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(2);
    });

    it("el solape se mira POR PROFESIONAL: la franja de otro no estorba", async () => {
        await sembrarProfesional();
        await POST(req(cuerpo("10:00")));

        const { perfil: otro } = await sembrarProfesional();
        const res = await POST(req(cuerpo("10:00")));

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: otro.id } })).toBe(1);
    });

    it("contraprueba · una modalidad que NO atiende se rechaza", async () => {
        const { perfil } = await sembrarProfesional({ virtual: true, presencial: false });

        const res = await POST(req(cuerpo("10:00", "PRESENCIAL")));

        expect(res.status).toBe(400);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("sin sesión de PROFESIONAL no se publica nada", async () => {
        mockToken = undefined;
        const res = await POST(req(cuerpo("10:00")));
        expect([401, 403]).toContain(res.status);
    });
});

describe("DELETE /api/profesional/franjas/[id] · SPEC-447", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("retira una franja libre y la fila DESAPARECE", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: perfil.id },
        });

        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(200);
        expect(await prisma.franjaDisponible.count({ where: { profesionalId: perfil.id } })).toBe(0);
    });

    it("contraprueba · una franja TOMADA no se puede retirar — hay una familia esperando", async () => {
        const { perfil } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: perfil.id },
        });
        await prisma.franjaDisponible.update({ where: { id: franja.id }, data: { tomada: true } });

        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(400);
        // Lo que importa no es el código: es que la franja SIGA ahí.
        expect(await prisma.franjaDisponible.count({ where: { id: franja.id } })).toBe(1);
    });

    it("un profesional no puede retirar la franja de otro", async () => {
        const { perfil: ajeno } = await sembrarProfesional();
        await POST(req(cuerpo("10:00")));
        const franja = await prisma.franjaDisponible.findFirstOrThrow({
            where: { profesionalId: ajeno.id },
        });

        // Segundo profesional: `sembrarProfesional` reemplaza el token de sesión.
        await sembrarProfesional();
        const res = await DELETE(new Request("http://localhost:5005/x"), {
            params: Promise.resolve({ id: franja.id }),
        });

        expect(res.status).toBe(404);
        expect(await prisma.franjaDisponible.count({ where: { id: franja.id } })).toBe(1);
    });
});
