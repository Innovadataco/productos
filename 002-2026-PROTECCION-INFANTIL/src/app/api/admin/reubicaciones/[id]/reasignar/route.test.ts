/**
 * SPEC-832 (pieza 2) · Ruta POST /api/admin/reubicaciones/[id]/reasignar.
 * Dos garantías: el camino feliz reubica (200), y —requisito del CEO— el rechazo por caducidad entre ver y
 * confirmar (B dejó de ser ofrecible para la modalidad) llega como MENSAJE 400, NO como 500 mudo.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

// verifyAuth lee el token de `next/headers` (no del Request). En test se mockea, como las demás rutas admin.
let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { POST } from "./route";

const DIA = 24 * 60 * 60 * 1000;
const W_INICIO = new Date(Date.now() + 3 * DIA);
const W_FIN = new Date(W_INICIO.getTime() + 50 * 60 * 1000);
let bogotaId: string;

async function seedPro(nombre: string, repsModalidades?: ("PRESENCIAL" | "TELEMEDICINA")[]) {
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: nombre,
            tituloProfesional: "Psicólogo",
            especialidades: ["TRAUMA"],
            ciudadId: bogotaId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Perfil de prueba.",
            tarifaConsultaCOP: 100_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const rev = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: rev.id,
            revisadoEn: new Date(Date.now() - 2 * DIA),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `a-${perfil.id}`,
            venceEn: new Date(Date.now() + 90 * DIA),
        },
    });
    if (repsModalidades) {
        await prisma.verificacionReps.create({
            data: {
                profesionalId: perfil.id,
                verificadoEn: new Date(Date.now() - 2 * DIA),
                fuente: "MANUAL_ADMIN",
                resultado: "VIGENTE",
                vigenteHasta: new Date(Date.now() + 180 * DIA),
                modalidades: repsModalidades,
            },
        });
    }
    return perfil;
}

async function escenario(repsB?: ("PRESENCIAL" | "TELEMEDICINA")[]) {
    const padre = await crearUsuario("PARENT");
    const a = await seedPro("Prof. A");
    const franjaA = await prisma.franjaDisponible.create({
        data: { profesionalId: a.id, inicio: W_INICIO, fin: W_FIN, modalidad: "VIRTUAL", tomada: true },
    });
    const cita = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: a.id,
            franjaId: franjaA.id,
            presentacion: "Relato.",
            urgencia: "SIN_APURO",
            estado: "CONFIRMADA",
            venceEn: new Date(Date.now() + 72 * 60 * 60 * 1000),
            pagoAprobadoEn: new Date(Date.now() - DIA),
            montoConsulta: 100_000,
            montoServicio: 15_000,
            montoTotal: 115_000,
            porcentajeServicio: 15,
        },
    });
    const b = await seedPro("Prof. B", repsB);
    const franjaB = await prisma.franjaDisponible.create({
        data: { profesionalId: b.id, inicio: W_INICIO, fin: W_FIN, modalidad: "VIRTUAL", tomada: false },
    });
    return { cita, b, franjaB };
}

async function postReasignar(adminToken: string, citaId: string, body: unknown) {
    const req = crearRequestAutenticado("POST", `http://localhost/api/admin/reubicaciones/${citaId}/reasignar`, body, adminToken);
    return POST(req, { params: Promise.resolve({ id: citaId }) });
}

describe("POST /api/admin/reubicaciones/[id]/reasignar", { timeout: 30_000 }, () => {
    let adminToken: string;

    beforeAll(async () => {
        await resetDatabase();
        bogotaId = (await crearPaisCiudad()).ciudad.id;
    });
    afterAll(async () => prisma.$disconnect());
    beforeEach(async () => {
        await resetDatabase();
        bogotaId = (await crearPaisCiudad()).ciudad.id;
        const admin = await crearUsuario("ADMIN");
        adminToken = await crearTokenUsuario(admin.id, "ADMIN");
        mockToken = adminToken; // verifyAuth lo lee del mock de next/headers
    });

    it("camino feliz: reubica (200) y la cita origen queda REUBICADA", async () => {
        const e = await escenario(); // B sin fila REPS → SIN_VERIFICAR, cutover abierto → ofrecible
        const res = await postReasignar(adminToken, e.cita.id, { nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id });
        expect(res.status).toBe(200);
        const origen = await prisma.solicitudCita.findUnique({ where: { id: e.cita.id } });
        expect(origen!.estado).toBe("REUBICADA");
    });

    it("REQUISITO CEO · caducidad (B no ofrecible para la modalidad) → 400 con MENSAJE, no 500", async () => {
        const e = await escenario(["PRESENCIAL"]); // REPS cubre solo presencial; la cita es VIRTUAL
        const res = await postReasignar(adminToken, e.cita.id, { nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id });
        expect(res.status).toBe(400);
        expect(res.status).not.toBe(500);
        const cuerpo = await res.json();
        // Mensaje legible (AppError.toJSON → { error: { message, code } }), no un 500 mudo.
        expect(typeof cuerpo.error.message).toBe("string");
        expect(cuerpo.error.message.length).toBeGreaterThan(0);
        // Y el origen NO se tocó.
        const origen = await prisma.solicitudCita.findUnique({ where: { id: e.cita.id } });
        expect(origen!.estado).toBe("CONFIRMADA");
    });
});
