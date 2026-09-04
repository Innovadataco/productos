/**
 * SPEC-425 (A-75 · L5) · GET /api/profesional/panel contra la BD.
 *
 * Lo que este archivo tiene que probar de verdad es **la regla del brief §3**:
 * las citas `SIN_CONFIRMAR` no suman al marcador. Es un número que el
 * profesional va a leer como su año de trabajo — si cuenta solicitudes que ni
 * respondió, le está mintiendo sobre su propio desempeño.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import type { EstadoSolicitudCita } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const HORA = 60 * 60 * 1000;

async function sembrarProfesional() {
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
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}@ejemplo.local`);
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
            estado: "ACTIVO",
        },
    });
    return { usuario, perfil };
}

/** Una solicitud de una familia distinta cada vez, en el estado pedido. */
async function sembrarSolicitud(
    perfilId: string,
    estado: EstadoSolicitudCita,
    opciones: { horasDesdeAhora?: number; padreId?: string; conExpediente?: boolean } = {},
) {
    const padreId =
        opciones.padreId ?? (await crearUsuario("PARENT", `papa.${Date.now()}.${Math.random()}@ejemplo.local`)).id;
    const inicio = new Date(Date.now() + (opciones.horasDesdeAhora ?? 48) * HORA);
    const franja = await prisma.franjaDisponible.create({
        data: {
            profesionalId: perfilId,
            inicio,
            fin: new Date(inicio.getTime() + HORA),
            modalidad: "VIRTUAL",
            tomada: true,
        },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId: perfilId,
            franjaId: franja.id,
            presentacion: "Necesito orientación.",
            urgencia: "SIN_APURO",
            estado,
            venceEn: new Date(Date.now() + 48 * HORA),
            pagoAprobadoEn: estado === "SIN_CONFIRMAR" ? null : new Date(),
            montoConsulta: 180000,
            montoServicio: 27000,
            montoTotal: 207000,
            porcentajeServicio: 15,
        },
    });
}

async function sembrarComision(porcentaje: number) {
    await prisma.parametroSistema.upsert({
        where: { clave: "comision.porcentaje" },
        update: { valor: String(porcentaje) },
        create: {
            clave: "comision.porcentaje",
            valor: String(porcentaje),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "Comisión de la red (test)",
        },
    });
}

async function leerPanel() {
    const res = await GET();
    expect(res.status).toBe(200);
    return (await res.json()).data;
}

describe("GET /api/profesional/panel · SPEC-425 (A-75 · L5)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        // SPEC-403: la comisión es parámetro y el panel falla en cerrado sin
        // ella. `resetDatabase` no siembra parámetros, así que la pone el test.
        await sembrarComision(15);
    });

    afterAll(async () => prisma.$disconnect());

    it("un profesional recién verificado ve su panel vacío, sin números inventados", async () => {
        await sembrarProfesional();
        const panel = await leerPanel();
        expect(panel.nombreVisible).toBe("Mariana Restrepo");
        expect(panel.solicitudes).toEqual([]);
        expect(panel.marcador).toEqual({ familiasAtendidas: 0, solicitudesRecibidas: 0, sinConfirmar: 0 });
        expect(panel.porCobrar.montoRetenido).toBe(0);
    });

    it("BRIEF §3: las SIN_CONFIRMAR se cuentan aparte y NO suman a familias atendidas", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarSolicitud(perfil.id, "SIN_CONFIRMAR");
        await sembrarSolicitud(perfil.id, "SIN_CONFIRMAR");
        await sembrarSolicitud(perfil.id, "CONFIRMADA");

        const panel = await leerPanel();
        expect(panel.marcador.sinConfirmar).toBe(2);
        expect(panel.marcador.solicitudesRecibidas).toBe(3);
        expect(
            panel.marcador.familiasAtendidas,
            "solo la confirmada: las dos sin responder no son trabajo hecho",
        ).toBe(1);
    });

    it("una familia que pidió dos citas es UNA familia, no dos", async () => {
        const { perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `repetido.${Date.now()}@ejemplo.local`);
        await sembrarSolicitud(perfil.id, "CONFIRMADA", { padreId: padre.id });
        await sembrarSolicitud(perfil.id, "CONFIRMADA", { padreId: padre.id });

        const panel = await leerPanel();
        expect(panel.marcador.familiasAtendidas).toBe(1);
        expect(panel.marcador.solicitudesRecibidas).toBe(2);
    });

    it("separa la agenda de los casos por cerrar por la hora de la cita", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarSolicitud(perfil.id, "CONFIRMADA", { horasDesdeAhora: -3 }); // ya pasó
        await sembrarSolicitud(perfil.id, "CONFIRMADA", { horasDesdeAhora: 72 }); // por venir

        const panel = await leerPanel();
        expect(panel.casosPorCerrar).toHaveLength(1);
        expect(panel.citasConfirmadas).toHaveLength(1);
        // El pago de las dos sigue retenido hasta el cierre (L6).
        expect(panel.porCobrar.montoRetenido).toBe(360000);
        expect(panel.porCobrar.citasEsperandoCierre).toBe(2);
    });

    it("el desglose de la tarifa es el que se le cobró al padre, no uno inventado", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarSolicitud(perfil.id, "CONFIRMADA"); // se cobró al 15 %
        const panel = await leerPanel();
        expect(
            panel.porCobrar.desglose,
            "una solicitud ya creada conserva el porcentaje con el que se cobró",
        ).toEqual({
            tarifaProfesional: 180000,
            pagaElPadre: 207000,
            servicioRed: 27000,
            porcentajeServicio: 15,
        });
    });

    it("SPEC-403: sin solicitudes, muestra el porcentaje VIGENTE del parámetro", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarComision(10);
        expect((await leerPanel()).porCobrar.desglose).toEqual({
            tarifaProfesional: 180000,
            pagaElPadre: 198000,
            servicioRed: 18000,
            porcentajeServicio: 10,
        });

        // El admin lo cambia y la pantalla cambia con él, sin desplegar.
        await sembrarComision(20);
        expect((await leerPanel()).porCobrar.desglose.porcentajeServicio).toBe(20);
        expect(perfil.tarifaConsultaCOP).toBe(180000);
    });

    it("SPEC-403: sin el parámetro NO se inventa un número — falla en cerrado", async () => {
        // Es plata. Cobrar un porcentaje inventado porque el seed no corrió es
        // peor que no poder mostrar el panel.
        await sembrarProfesional();
        await prisma.parametroSistema.delete({ where: { clave: "comision.porcentaje" } });
        const res = await GET();
        expect(res.status).toBe(500);
        const cuerpo = await res.json();
        expect(JSON.stringify(cuerpo)).toContain("comision.porcentaje");
    });

    it("el plazo de 48 h solo existe cuando el pago ya fue aprobado", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarSolicitud(perfil.id, "SIN_CONFIRMAR"); // sin pagoAprobadoEn
        await sembrarSolicitud(perfil.id, "PAGADA_PENDIENTE"); // con pagoAprobadoEn

        const panel = await leerPanel();
        const sinPago = panel.solicitudes.find((s: { reservaPagada: boolean }) => !s.reservaPagada);
        const conPago = panel.solicitudes.find((s: { reservaPagada: boolean }) => s.reservaPagada);
        expect(sinPago.venceEnRespuesta, "sin pago aprobado el reloj no arrancó").toBeNull();
        expect(conPago.venceEnRespuesta).not.toBeNull();
    });

    it("otro profesional no ve nada de este — el panel es por perfil", async () => {
        const { perfil } = await sembrarProfesional();
        await sembrarSolicitud(perfil.id, "CONFIRMADA");
        // Segundo profesional, sesión nueva.
        await sembrarProfesional();
        const panel = await leerPanel();
        expect(panel.marcador.solicitudesRecibidas).toBe(0);
        expect(panel.citasConfirmadas).toEqual([]);
    });

    it("sin sesión de PROFESIONAL responde 401/403", async () => {
        mockToken = undefined;
        const res = await GET();
        expect([401, 403]).toContain(res.status);
    });

    it("SPEC-427 (B3): una cita AUTOCERRADA no aparece como sin responder ni suma al marcador", async () => {
        const { perfil } = await sembrarProfesional();
        // Una autocerrada: quedó SIN_CONFIRMAR pero con `autocerradaEn` puesto.
        const cerrada = await sembrarSolicitud(perfil.id, "CONFIRMADA", { horasDesdeAhora: -240 });
        await prisma.solicitudCita.update({
            where: { id: cerrada.id },
            data: { estado: "SIN_CONFIRMAR", autocerradaEn: new Date() },
        });
        // Y una SIN_CONFIRMAR genuina (impaga, esperando respuesta).
        await sembrarSolicitud(perfil.id, "SIN_CONFIRMAR");

        const panel = await leerPanel();

        // La autocerrada NO está entre las que esperan respuesta...
        expect(panel.solicitudes.map((x: { id: string }) => x.id)).not.toContain(cerrada.id);
        // ...y NO suma al marcador (solo la genuina cuenta).
        expect(panel.marcador.sinConfirmar).toBe(1);
        // Pero SÍ está en su propio bloque, para que el profesional la vea.
        expect(panel.autocerradas.map((x: { id: string }) => x.id)).toContain(cerrada.id);
    });

});
