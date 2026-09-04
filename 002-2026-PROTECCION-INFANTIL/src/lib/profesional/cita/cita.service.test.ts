/**
 * SPEC-428 · cita.service · dos garantías clave del brief §9 §4:
 *   (b) `crearSolicitudCita` con `montoConsultaOverride` cobra el PRECIO
 *       ESTÁNDAR (no la tarifa del profesional).
 *   (c) `reasignarPorPadre` HEREDA el monto de la solicitud original — no
 *       vuelve a cobrar y el nuevo `pagoAprobadoEn` arranca el reloj de 48 h.
 *
 * Sirve además como red de seguridad para SPEC-395 (motor de citas), que
 * antes no tenía test propio de estos flujos.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearSolicitudCita, reasignarPorPadre } from "./cita.service";

async function seedProfesional(tarifaCOP = 120_000) {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Uno",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: tarifaCOP,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
}

async function seedFranja(profesionalId: string, offsetDias = 3) {
    const inicio = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin, modalidad: "VIRTUAL", tomada: false },
    });
}

describe("SPEC-428 · crearSolicitudCita · precio ESTÁNDAR sobre tarifa del profesional", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("con `montoConsultaOverride` cobra el precio estándar (no la tarifa del profesional)", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional(120_000); // tarifa del profesional
        const franja = await seedFranja(pro.id);

        const solicitud = await crearSolicitudCita({
            padreUsuarioId: padre.id,
            profesionalId: pro.id,
            franjaId: franja.id,
            presentacion: "Mi hijo está con miedo a irse al colegio, quiero ayuda.",
            urgencia: "SIN_APURO",
            porcentajeServicio: 15,
            montoConsultaOverride: 50_000, // precio ESTÁNDAR del admin
        });

        // Se cobra el estándar, no la tarifa del profesional.
        expect(solicitud.montoConsulta).toBe(50_000);
        expect(solicitud.montoServicio).toBe(7_500); // 15 % de 50 000
        expect(solicitud.montoTotal).toBe(57_500);
        expect(solicitud.porcentajeServicio).toBe(15);
    });

    it("SIN override cae a la tarifa del profesional (compatibilidad hacia atrás)", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional(120_000);
        const franja = await seedFranja(pro.id);

        const solicitud = await crearSolicitudCita({
            padreUsuarioId: padre.id,
            profesionalId: pro.id,
            franjaId: franja.id,
            presentacion: "Contexto suficiente para pasar el mínimo del schema.",
            urgencia: "SIN_APURO",
            porcentajeServicio: 15,
        });

        expect(solicitud.montoConsulta).toBe(120_000);
        expect(solicitud.montoServicio).toBe(18_000);
        expect(solicitud.montoTotal).toBe(138_000);
    });
});

describe("SPEC-428 · reasignarPorPadre · hereda el monto y NO cobra de nuevo", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea una fila nueva con `pagoHeredadoDeId` y los mismos montos que la original", async () => {
        const padre = await crearUsuario("PARENT");
        const proA = await seedProfesional(120_000);
        const proB = await seedProfesional(200_000); // tarifa del OTRO profesional
        const franjaA = await seedFranja(proA.id);
        const franjaB = await seedFranja(proB.id, 5);

        const original = await crearSolicitudCita({
            padreUsuarioId: padre.id,
            profesionalId: proA.id,
            franjaId: franjaA.id,
            presentacion: "Presentación válida para el schema del padre acá.",
            urgencia: "SIN_APURO",
            porcentajeServicio: 15,
            montoConsultaOverride: 50_000,
        });
        // Estado que habilita reasignación según el service:
        await prisma.solicitudCita.update({
            where: { id: original.id },
            data: { estado: "VENCIDA_SIN_RESPUESTA" },
        });

        const nueva = await reasignarPorPadre({
            padreUsuarioId: padre.id,
            solicitudId: original.id,
            nuevoProfesionalId: proB.id,
            nuevaFranjaId: franjaB.id,
        });

        // Fila nueva.
        expect(nueva.id).not.toBe(original.id);
        expect(nueva.profesionalId).toBe(proB.id);
        expect(nueva.franjaId).toBe(franjaB.id);
        // Hereda el pago y NO recalcula con la tarifa del nuevo profesional.
        expect(nueva.pagoHeredadoDeId).toBe(original.id);
        expect(nueva.solicitudPreviaId).toBe(original.id);
        expect(nueva.montoConsulta).toBe(original.montoConsulta);
        expect(nueva.montoServicio).toBe(original.montoServicio);
        expect(nueva.montoTotal).toBe(original.montoTotal);
        // El reloj de 48h arranca YA (no espera aprobación manual).
        expect(nueva.pagoAprobadoEn).not.toBeNull();

        // La original se conserva como historial en el estado terminal.
        const originalDespues = await prisma.solicitudCita.findUnique({ where: { id: original.id } });
        expect(originalDespues?.estado).toBe("VENCIDA_SIN_RESPUESTA");
    });

    it("rechaza reasignar hacia el MISMO profesional", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franjaA = await seedFranja(pro.id);
        const franjaB = await seedFranja(pro.id, 5);

        const original = await crearSolicitudCita({
            padreUsuarioId: padre.id,
            profesionalId: pro.id,
            franjaId: franjaA.id,
            presentacion: "Presentación válida para el schema del padre acá.",
            urgencia: "SIN_APURO",
            porcentajeServicio: 15,
            montoConsultaOverride: 50_000,
        });
        await prisma.solicitudCita.update({
            where: { id: original.id },
            data: { estado: "VENCIDA_SIN_RESPUESTA" },
        });

        await expect(
            reasignarPorPadre({
                padreUsuarioId: padre.id,
                solicitudId: original.id,
                nuevoProfesionalId: pro.id,
                nuevaFranjaId: franjaB.id,
            }),
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
