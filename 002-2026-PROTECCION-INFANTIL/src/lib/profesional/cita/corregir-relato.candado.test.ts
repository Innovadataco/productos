/**
 * SPEC-780 · CANDADO de la rectificación del relato (integración, BD de test).
 *
 * El criterio del CEO: sobre una CADENA de reprogramación (cada fila COPIA el relato), corregir
 * toca SOLO la fila viva y CONSERVA el historial — y el conteo «cuántas cambiaron / cuántas no»
 * ES el criterio. Además: no se corrige una fila con sucesor (historial), y el texto NO entra al
 * registro del hecho (no viaja a bi_replica).
 *
 * La cadena se siembra con la MISMA forma que produce reprogramar (`cita.service.ts:291`): fila
 * nueva que copia `original.presentacion` + `solicitudPreviaId`, y la original queda REPROGRAMADA.
 * (El service real limita a una reprogramación gratis por dupla; acá se arma la forma del dato
 * directo para tener una cadena de 3 determinista.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { corregirRelatoCita } from "@/lib/profesional/cita/corregir-relato.service";

const RELATO_ORIGINAL = "Relato con el dato equivocado XILOFONO-ORIGINAL sobre mi situacion.";
const RELATO_CORREGIDO = "Relato ya corregido XILOFONO-CORREGIDO sobre mi situacion.";
const MIN = 60 * 1000;

async function seed() {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profU = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profU.id,
            nombreVisible: "Prof. Relato 780",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: 120_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    // El actor es un operador/admin REAL (AuditLog.usuarioId es FK a Usuario).
    const actor = await crearUsuario("OPERADOR");
    return { padreId: padre.id, perfilId: perfil.id, actorId: actor.id };
}

async function crearCita(
    perfilId: string,
    padreId: string,
    inicioMs: number,
    solicitudPreviaId: string | null,
    estado: "CONFIRMADA" | "REPROGRAMADA",
) {
    const inicio = new Date(inicioMs);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfilId, inicio, fin: new Date(inicioMs + 50 * MIN), modalidad: "VIRTUAL", tomada: true },
    });
    // Forma que produce reprogramar: relato COPIADO verbatim + solicitudPreviaId (la original queda
    // REPROGMADA). Se crea directo (el service de creación tiene chequeos ajenos a este candado).
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId: perfilId,
            franjaId: franja.id,
            presentacion: RELATO_ORIGINAL,
            urgencia: "SIN_APURO",
            estado,
            venceEn: new Date(inicioMs),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
            ...(solicitudPreviaId ? { solicitudPreviaId, pagoHeredadoDeId: solicitudPreviaId } : {}),
        },
    });
}

const relatoDe = async (id: string) =>
    (await prisma.solicitudCita.findUnique({ where: { id }, select: { presentacion: true } }))?.presentacion;

describe("SPEC-780 · corregirRelatoCita (integración)", { timeout: 40_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("cadena de reprogramación: corrige SOLO la viva, conserva el historial (el CONTEO es el criterio)", async () => {
        const { padreId, perfilId, actorId } = await seed();
        const ahora = Date.now();
        // a y b son historial (tienen sucesor); c es la viva.
        const a = await crearCita(perfilId, padreId, ahora + 1 * 24 * 60 * MIN, null, "REPROGRAMADA");
        const b = await crearCita(perfilId, padreId, ahora + 2 * 24 * 60 * MIN, a.id, "REPROGRAMADA");
        const c = await crearCita(perfilId, padreId, ahora + 3 * 24 * 60 * MIN, b.id, "CONFIRMADA");

        await corregirRelatoCita({ solicitudId: c.id, presentacion: RELATO_CORREGIDO, actorId });

        // CONTEO: 1 corregida (la viva), 2 conservadas (el historial).
        expect(await relatoDe(c.id), "la viva se corrige").toBe(RELATO_CORREGIDO);
        expect(await relatoDe(a.id), "el historial NO se reescribe").toBe(RELATO_ORIGINAL);
        expect(await relatoDe(b.id), "el historial NO se reescribe").toBe(RELATO_ORIGINAL);
        const corregidas = [await relatoDe(a.id), await relatoDe(b.id), await relatoDe(c.id)].filter(
            (r) => r === RELATO_CORREGIDO,
        ).length;
        expect(corregidas, "exactamente UNA fila cambió").toBe(1);
    });

    it("una fila con sucesor (historial) NO se corrige — se rechaza", async () => {
        const { padreId, perfilId, actorId } = await seed();
        const ahora = Date.now();
        const a = await crearCita(perfilId, padreId, ahora + 1 * 24 * 60 * MIN, null, "REPROGRAMADA");
        const b = await crearCita(perfilId, padreId, ahora + 2 * 24 * 60 * MIN, a.id, "CONFIRMADA");

        await expect(
            corregirRelatoCita({ solicitudId: a.id, presentacion: RELATO_CORREGIDO, actorId }),
        ).rejects.toThrow(/reprogramada|registro|vigente/i);
        expect(await relatoDe(a.id), "el historial quedó intacto").toBe(RELATO_ORIGINAL);
        // control positivo: la viva (b) sí se puede corregir
        await corregirRelatoCita({ solicitudId: b.id, presentacion: RELATO_CORREGIDO, actorId });
        expect(await relatoDe(b.id)).toBe(RELATO_CORREGIDO);
    });

    it("el rastro registra el HECHO pero NUNCA el texto (ni anterior ni nuevo)", async () => {
        const { padreId, perfilId, actorId } = await seed();
        const a = await crearCita(perfilId, padreId, Date.now() + 1 * 24 * 60 * MIN, null, "CONFIRMADA");
        await corregirRelatoCita({ solicitudId: a.id, presentacion: RELATO_CORREGIDO, actorId });

        const logs = await prisma.auditLog.findMany({ where: { accion: "CITA_PROFESIONAL_RELATO_CORREGIDO", recursoId: a.id } });
        expect(logs.length, "queda el hecho de la corrección").toBe(1);
        const serial = JSON.stringify(logs[0]);
        expect(serial).not.toContain("XILOFONO-CORREGIDO"); // el texto nuevo no está
        expect(serial).not.toContain("XILOFONO-ORIGINAL"); // el anterior tampoco
    });
});
