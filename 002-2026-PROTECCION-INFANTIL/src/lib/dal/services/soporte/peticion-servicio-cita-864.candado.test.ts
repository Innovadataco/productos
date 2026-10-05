/**
 * CANDADO · SPEC-864 (FORMA-SPEC864 §2.4-2.6) · «El profesional no cumplió» — lado servicio.
 *
 * El reclamo del padre reusa la puerta de PQR: `crearPeticionServicio({ motivo: "CITA", solicitudId })`.
 * Conductas contra la BD que NO se pueden fingir:
 *
 *  §2.6   ata la PQR a la cita: la fila queda con `solicitudId` = esta cita, motivo CITA, sin enlace legal.
 *  §2.5.4 es una ANOTACIÓN, no un dictamen: NO transiciona `EstadoSolicitudCita` (la cita sigue igual).
 *         Control positivo: el estado ANTES == el estado DESPUÉS.
 *  §2.5.5 no se radica dos veces: con una PQR ABIERTA de esa cita, un segundo intento DEVUELVE la misma
 *         (idempotente) y NO crea otra. Resuelta la primera, un nuevo intento SÍ crea una nueva (el dedup
 *         solo mira las abiertas).
 *  propiedad: atar la cita de OTRO padre se RECHAZA y no deja fila.
 *  CITA-only: `solicitudId` con un motivo que no es CITA se RECHAZA (un detalle de cita en otro motivo
 *         es un dato sin sentido).
 *  `peticionDeCitaAbierta` (la FUENTE del marcador del DTO) deriva de `solicitudId`: null sin PQR,
 *         el número con PQR abierta, y null de nuevo tras resolverla.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearPeticionServicio, peticionDeCitaAbierta } from "./peticion-servicio.service";

async function seedProfesional() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Torres",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 5,
            presentacion: "Trabaja con niños y adolescentes.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
}

async function seedCita(padreId: string, profesionalId: string, estado: "CONFIRMADA" | "PAGADA_PENDIENTE" = "CONFIRMADA") {
    const inicio = new Date(Date.now() - 26 * 3600_000); // franja de ayer (CONFIRMADA-pasada)
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin, modalidad: "VIRTUAL", tomada: true },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId,
            franjaId: franja.id,
            presentacion: "Buenas, mi hijo tiene ansiedad escolar.",
            urgencia: "SIN_APURO",
            estado,
            venceEn: new Date(Date.now() - 2 * 3600_000),
            pagoAprobadoEn: new Date(Date.now() - 50 * 3600_000),
            montoConsulta: 50000,
            montoServicio: 7500,
            montoTotal: 57500,
            porcentajeServicio: 15,
        },
    });
}

describe("SPEC-864 · servicio: reclamo «no cumplió» atado a la cita", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("§2.6: CITA + solicitudId deja la PQR atada a la cita (motivo CITA, sin enlace legal)", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id);

        const { numeroSeguimiento } = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });

        const pqr = await prisma.peticionServicio.findUnique({ where: { id: numeroSeguimiento } });
        expect(pqr?.motivo).toBe("CITA");
        expect(pqr?.solicitudId, "la PQR apunta a ESTA cita").toBe(cita.id);
        expect(pqr?.resueltoEn, "nace abierta").toBeNull();
        expect(pqr?.solicitudHabeasDataId, "una cita no es habeas data: sin enlace legal").toBeNull();
    });

    it("§2.5.4: avisar es una ANOTACIÓN — NO transiciona el estado de la cita", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id, "CONFIRMADA");
        const estadoAntes = (await prisma.solicitudCita.findUnique({ where: { id: cita.id }, select: { estado: true } }))!.estado;

        await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });

        const estadoDespues = (await prisma.solicitudCita.findUnique({ where: { id: cita.id }, select: { estado: true } }))!.estado;
        expect(estadoDespues, "el reclamo del padre no dicta el estado de la cita").toBe(estadoAntes);
        expect(estadoDespues).toBe("CONFIRMADA");
    });

    it("§2.5.5: no se radica dos veces — segundo intento DEVUELVE la misma PQR (idempotente)", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id);

        const a = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });
        const b = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });
        expect(b.numeroSeguimiento, "misma cita abierta → misma PQR").toBe(a.numeroSeguimiento);
        expect(await prisma.peticionServicio.count({ where: { solicitudId: cita.id } }), "una sola fila").toBe(1);
    });

    it("§2.5.5: resuelta la primera, un nuevo aviso SÍ crea otra (el dedup solo mira las abiertas)", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id);

        const a = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });
        await prisma.peticionServicio.update({ where: { id: a.numeroSeguimiento }, data: { resueltoEn: new Date() } });
        const b = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });
        expect(b.numeroSeguimiento, "la resuelta no bloquea un reclamo nuevo").not.toBe(a.numeroSeguimiento);
        expect(await prisma.peticionServicio.count({ where: { solicitudId: cita.id } })).toBe(2);
    });

    it("propiedad: atar la cita de OTRO padre se RECHAZA y no deja fila", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const citaAjena = await seedCita(otro.id, prof.id);

        await expect(
            crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: citaAjena.id }),
        ).rejects.toThrow(/no encontramos esa cita/i);
        expect(await prisma.peticionServicio.count(), "un rechazo no deja fila").toBe(0);
    });

    it("CITA-only: `solicitudId` con un motivo que no es CITA se RECHAZA", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id);
        await expect(
            crearPeticionServicio({ usuarioId: padre.id, motivo: "SERVICIO_PLATAFORMA", solicitudId: cita.id }),
        ).rejects.toThrow(/una petición de una cita se ata a una cita/i);
        expect(await prisma.peticionServicio.count()).toBe(0);
    });

    it("`peticionDeCitaAbierta` (fuente del marcador) deriva de solicitudId: null → número → null tras resolver", async () => {
        const padre = await crearUsuario("PARENT");
        const prof = await seedProfesional();
        const cita = await seedCita(padre.id, prof.id);

        expect(await peticionDeCitaAbierta(cita.id, padre.id), "sin PQR: null").toBeNull();

        const { numeroSeguimiento } = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", solicitudId: cita.id });
        expect(await peticionDeCitaAbierta(cita.id, padre.id)).toEqual({ numeroSeguimiento });

        await prisma.peticionServicio.update({ where: { id: numeroSeguimiento }, data: { resueltoEn: new Date() } });
        expect(await peticionDeCitaAbierta(cita.id, padre.id), "resuelta: el marcador desaparece").toBeNull();
    });
});
