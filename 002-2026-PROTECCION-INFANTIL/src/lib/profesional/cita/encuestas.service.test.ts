/**
 * SPEC-429 · encuestas.service — cierra los tres escenarios que el CEO pidió
 * probados desde el primer commit (23:5x):
 *   1) Cruce coherente (padre y profesional dicen lo mismo) → SIN incidente.
 *   2) Cruce contradictorio en r1 → incidente P1.
 *   3) Cruce contradictorio en r2 → incidente P2.
 *
 * Plus: guardia `encuestaPendiente` — sube al abrir, baja al responder la
 * última pendiente, se mantiene si queda otra.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import {
    registrarRespuestaEncuesta,
    proximaEncuestaPendiente,
    cruzarEncuestasSiCompletas,
    type RespuestasEncuesta,
} from "./encuestas.service";
import { alCumplirCita } from "./al-cumplir";

async function seedProfesional() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Test",
            tituloProfesional: "Psicólogo",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    return { perfil, usuario };
}

async function seedFranja(perfilId: string, offsetDias = 3) {
    const inicio = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: { profesionalId: perfilId, inicio, fin, modalidad: "VIRTUAL", tomada: true },
    });
}

async function seedSolicitudCumplida(padreId: string, perfilId: string, franjaId: string) {
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId: perfilId,
            franjaId,
            presentacion: "Presentación válida para el schema del padre acá.",
            urgencia: "SIN_APURO",
            estado: "CUMPLIDA",
            venceEn: new Date(Date.now() + 48 * 60 * 60 * 1000),
            pagoAprobadoEn: new Date(),
            montoConsulta: 50_000,
            montoServicio: 7_500,
            montoTotal: 57_500,
            porcentajeServicio: 15,
        },
    });
}

const R_COHERENTES_SI: RespuestasEncuesta = {
    r1: "SI", r2: "SI", r3: "SI", r4: "SI", r5: "SI",
};

describe("SPEC-429 · cruce de encuestas r1/r2", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("responden coherentes (ambos «SÍ» en r1 y r2) → SIN incidente", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil, usuario: prof } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: R_COHERENTES_SI,
        });
        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: prof.id,
            origen: "PROFESIONAL",
            respuestas: R_COHERENTES_SI,
        });

        const incidentes = await prisma.incidenteContradiccionEncuesta.findMany({
            where: { solicitudId: solicitud.id },
        });
        expect(incidentes).toHaveLength(0);
    });

    it("padre dice «se dio», profesional dice «no se presentó» → INCIDENTE P1", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil, usuario: prof } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: { ...R_COHERENTES_SI, r1: "SI" },
        });
        const resultado = await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: prof.id,
            origen: "PROFESIONAL",
            respuestas: { ...R_COHERENTES_SI, r1: "NO_FAMILIA_NO_SE_PRESENTO" },
        });

        expect(resultado.contradicciones).toBe(1);
        const incidentes = await prisma.incidenteContradiccionEncuesta.findMany({
            where: { solicitudId: solicitud.id },
        });
        expect(incidentes).toHaveLength(1);
        expect(incidentes[0].pregunta).toBe("P1");
        expect(incidentes[0].padreValor).toBe("SI");
        expect(incidentes[0].profesionalValor).toBe("NO_FAMILIA_NO_SE_PRESENTO");
        expect(incidentes[0].resueltoEn).toBeNull();
    });

    it("padre dice «a tiempo», profesional dice «no llegó» → INCIDENTE P2", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil, usuario: prof } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: { ...R_COHERENTES_SI, r2: "SI" },
        });
        const resultado = await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: prof.id,
            origen: "PROFESIONAL",
            respuestas: { ...R_COHERENTES_SI, r2: "NO_LLEGO" },
        });

        expect(resultado.contradicciones).toBe(1);
        const incidentes = await prisma.incidenteContradiccionEncuesta.findMany({
            where: { solicitudId: solicitud.id },
        });
        expect(incidentes.map((i) => i.pregunta)).toEqual(["P2"]);
    });

    it("un solo lado respondió → no cruza aún, sin incidente", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: R_COHERENTES_SI,
        });
        const cruce = await cruzarEncuestasSiCompletas(solicitud.id);
        expect(cruce.contradicciones).toBe(0);
        const incidentes = await prisma.incidenteContradiccionEncuesta.count({
            where: { solicitudId: solicitud.id },
        });
        expect(incidentes).toBe(0);
    });

    it("cruce es idempotente: llamarlo dos veces no duplica el incidente", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil, usuario: prof } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: { ...R_COHERENTES_SI, r1: "SI" },
        });
        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: prof.id,
            origen: "PROFESIONAL",
            respuestas: { ...R_COHERENTES_SI, r1: "NO_FAMILIA_NO_SE_PRESENTO" },
        });
        // Re-cruce manual: no debe crear otra fila.
        await cruzarEncuestasSiCompletas(solicitud.id);
        const incidentes = await prisma.incidenteContradiccionEncuesta.findMany({
            where: { solicitudId: solicitud.id },
        });
        expect(incidentes).toHaveLength(1);
    });
});

describe("SPEC-429 · guardia encuestaPendiente + alCumplirCita", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("alCumplirCita sube la guardia para padre y profesional", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil, usuario: prof } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);

        await alCumplirCita(solicitud.id);

        const padreDB = await prisma.usuario.findUnique({ where: { id: padre.id } });
        const profDB = await prisma.usuario.findUnique({ where: { id: prof.id } });
        expect(padreDB?.encuestaPendiente).toBe(true);
        expect(profDB?.encuestaPendiente).toBe(true);
    });

    it("respondiendo la única encuesta pendiente BAJA la guardia del usuario", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);
        await alCumplirCita(solicitud.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: R_COHERENTES_SI,
        });

        const padreDB = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(padreDB?.encuestaPendiente).toBe(false);
    });

    it("proximaEncuestaPendiente devuelve la más antigua sin responder", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franjaVieja = await seedFranja(perfil.id, 1);
        const franjaNueva = await seedFranja(perfil.id, 5);
        const sVieja = await seedSolicitudCumplida(padre.id, perfil.id, franjaVieja.id);
        await new Promise((r) => setTimeout(r, 30));
        const sNueva = await seedSolicitudCumplida(padre.id, perfil.id, franjaNueva.id);
        await alCumplirCita(sVieja.id);
        await alCumplirCita(sNueva.id);

        const proxima = await proximaEncuestaPendiente(padre.id);
        expect(proxima?.solicitudId).toBe(sVieja.id);
        expect(proxima?.origen).toBe("PADRE");
    });

    it("rechaza doble respuesta con 409", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);
        await alCumplirCita(solicitud.id);

        await registrarRespuestaEncuesta({
            solicitudId: solicitud.id,
            usuarioId: padre.id,
            origen: "PADRE",
            respuestas: R_COHERENTES_SI,
        });
        await expect(
            registrarRespuestaEncuesta({
                solicitudId: solicitud.id,
                usuarioId: padre.id,
                origen: "PADRE",
                respuestas: R_COHERENTES_SI,
            }),
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rechaza responder desde el lado incorrecto con 403", async () => {
        const padre = await crearUsuario("PARENT");
        const otroPadre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        const solicitud = await seedSolicitudCumplida(padre.id, perfil.id, franja.id);
        await alCumplirCita(solicitud.id);

        await expect(
            registrarRespuestaEncuesta({
                solicitudId: solicitud.id,
                usuarioId: otroPadre.id,
                origen: "PADRE",
                respuestas: R_COHERENTES_SI,
            }),
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("no permite responder antes de que la cita esté CUMPLIDA", async () => {
        const padre = await crearUsuario("PARENT");
        const { perfil } = await seedProfesional();
        const franja = await seedFranja(perfil.id);
        // Estado distinto de CUMPLIDA:
        const solicitud = await prisma.solicitudCita.create({
            data: {
                padreUsuarioId: padre.id,
                profesionalId: perfil.id,
                franjaId: franja.id,
                presentacion: "Presentación válida para el schema del padre acá.",
                urgencia: "SIN_APURO",
                estado: "PAGADA_PENDIENTE",
                venceEn: new Date(Date.now() + 48 * 60 * 60 * 1000),
                pagoAprobadoEn: new Date(),
                montoConsulta: 50_000,
                montoServicio: 7_500,
                montoTotal: 57_500,
                porcentajeServicio: 15,
            },
        });

        await expect(
            registrarRespuestaEncuesta({
                solicitudId: solicitud.id,
                usuarioId: padre.id,
                origen: "PADRE",
                respuestas: R_COHERENTES_SI,
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
