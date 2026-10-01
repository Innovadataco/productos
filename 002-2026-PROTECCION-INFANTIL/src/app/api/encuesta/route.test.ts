/**
 * SPEC-784 · C-2 · POST /api/encuesta contra la BD.
 *
 * Vigila desde la SUPERFICIE (no solo el modelo):
 *  - 2º envío del mismo lado → 409 (`@@unique([solicitudId, origen])`), no 500 ni duplicado.
 *  - El `origen` se DERIVA del rol autenticado (el body NO lo trae); un extraño a la cita → 403.
 *  - Coherencia del CHECK como defensa: duración sii se realizó; razón sii no → si no, 400.
 *  - Una cita que no pide encuesta (futura) → 409, no acepta la fila.
 *  - Con los DOS lados, el cruce (753) registra el incidente de contradicción.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST, GET } from "./route";
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
    const usuario = await crearUsuario("PROFESIONAL", `psi.${Date.now()}.${Math.random()}@ejemplo.local`);
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
            atiendeVirtual: true,
            estado: "ACTIVO",
        },
    });
    return { usuario, perfil };
}

/** Una cita entre un padre nuevo y el profesional dado, en el estado y tiempo pedidos. */
async function sembrarCita(
    perfilId: string,
    padreId: string,
    estado: EstadoSolicitudCita,
    horasDesdeAhora = -2, // por defecto: en el pasado (una CONFIRMADA queda PASADA → pide encuesta)
) {
    const inicio = new Date(Date.now() + horasDesdeAhora * HORA);
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
            pagoAprobadoEn: new Date(),
            montoConsulta: 180000,
            montoServicio: 27000,
            montoTotal: 207000,
            porcentajeServicio: 15,
        },
    });
}

function postEncuesta(body: unknown) {
    return POST(
        new Request("http://localhost/api/encuesta", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );
}

const REALIZADA = { seRealizo: true, operador: "SI", inicio: "A_TIEMPO", enlace: "SI", duracion: "ENTRE_30_45" } as const;
const NO_REALIZADA = {
    seRealizo: false,
    operador: "NO_HUBO_OPERADOR",
    inicio: "NO_COMENZO",
    enlace: "NO_FUNCIONO",
    razonNoRealizo: "OTRA_PARTE_NO_CONECTO",
} as const;

describe("POST /api/encuesta · SPEC-784 (C-2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("el padre registra su encuesta (201) y el 2º envío del mismo lado da 409, sin duplicar", async () => {
        const { perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        const cita = await sembrarCita(perfil.id, padre.id, "CONFIRMADA"); // franja pasada → PASADA

        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const primero = await postEncuesta({ solicitudId: cita.id, ...REALIZADA });
        expect(primero.status).toBe(200);

        const segundo = await postEncuesta({ solicitudId: cita.id, ...REALIZADA });
        expect(segundo.status).toBe(409);

        const filas = await prisma.encuestaCita.count({ where: { solicitudId: cita.id, origen: "PADRE" } });
        expect(filas).toBe(1);
    });

    it("un usuario que NO participa en la cita → 403 (el origen se deriva del rol, no del body)", async () => {
        const { perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        const cita = await sembrarCita(perfil.id, padre.id, "CONFIRMADA");
        const extrano = await crearUsuario("PARENT", `otro.${Date.now()}@ejemplo.local`);

        mockToken = await crearTokenUsuario(extrano.id, "PARENT");
        const res = await postEncuesta({ solicitudId: cita.id, ...REALIZADA });
        expect(res.status).toBe(403);
    });

    it("coherencia del CHECK: se realizó SIN duración → 400; no se realizó SIN razón → 400", async () => {
        const { perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        const cita = await sembrarCita(perfil.id, padre.id, "CONFIRMADA");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const sinDuracion = await postEncuesta({
            solicitudId: cita.id,
            seRealizo: true,
            operador: "SI",
            inicio: "A_TIEMPO",
            enlace: "SI",
        });
        expect(sinDuracion.status).toBe(400);

        const sinRazon = await postEncuesta({
            solicitudId: cita.id,
            seRealizo: false,
            operador: "NO_HUBO_OPERADOR",
            inicio: "NO_COMENZO",
            enlace: "NO_FUNCIONO",
        });
        expect(sinRazon.status).toBe(400);
    });

    it("una cita FUTURA (no pide encuesta aún) → 409, no acepta la fila", async () => {
        const { perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        const cita = await sembrarCita(perfil.id, padre.id, "CONFIRMADA", 48); // 48 h en el futuro → PROXIMA
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await postEncuesta({ solicitudId: cita.id, ...REALIZADA });
        expect(res.status).toBe(409);
        expect(await prisma.encuestaCita.count({ where: { solicitudId: cita.id } })).toBe(0);
    });

    it("con los DOS lados en desacuerdo sobre SE_REALIZO, el cruce (753) registra un incidente", async () => {
        const { usuario: profeUsuario, perfil } = await sembrarProfesional();
        const padre = await crearUsuario("PARENT", `papa.${Date.now()}@ejemplo.local`);
        const cita = await sembrarCita(perfil.id, padre.id, "CONFIRMADA");

        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await postEncuesta({ solicitudId: cita.id, ...NO_REALIZADA }); // padre: no se realizó

        mockToken = await crearTokenUsuario(profeUsuario.id, "PROFESIONAL");
        const res = await postEncuesta({ solicitudId: cita.id, ...REALIZADA }); // profesional: sí se realizó
        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(data.contradicciones).toBeGreaterThanOrEqual(1);

        const incidentes = await prisma.incidenteContradiccionEncuesta.count({ where: { solicitudId: cita.id } });
        expect(incidentes).toBeGreaterThanOrEqual(1);

        // GET del profesional: ya respondió → esta cita no le queda pendiente.
        const get = await GET();
        const pendientes = (await get.json()).data.pendientes as Array<{ solicitudId: string }>;
        expect(pendientes.some((p) => p.solicitudId === cita.id)).toBe(false);
    });
});
