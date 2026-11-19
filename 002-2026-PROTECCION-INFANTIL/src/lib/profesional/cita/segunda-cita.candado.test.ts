/**
 * CANDADO · SPEC-940 (I-452) — PI cobra e intermedia SOLO la primera cita con cada profesional.
 *
 * Brief A-75 v2.0 §4/§9 (Jelkin, 03-09): «De la segunda en adelante no se controla, no se intermedia y no se
 * cobra». VEREDICTO CEO: «1.ª cita» = la primera con ESE profesional. Por el servicio REAL y la BD:
 *   - 2.ª cita con el mismo profesional tras una CONFIRMADA (o posterior) → 409 EN EL SERVIDOR, sin solicitud y
 *     con la franja libre (esconder el botón no basta);
 *   - tras una que NO prosperó (vencida sin respuesta, reembolsada) → se puede pedir de nuevo;
 *   - 1.ª con OTRO profesional → permitida;
 *   - ningún camino cobra la tarifa del profesional: se cobra el precio estándar aunque la tarifa sea mayor.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearSolicitudCita, reprogramarPorPadre } from "./cita.service";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { debeExponerContacto } from "./dto";
import { FRAGMENTO_SEGUNDA_CITA_CANAL } from "./segunda-cita";
import type { EstadoSolicitudCita } from "@prisma/client";

async function seedProfesional(tarifaCOP: number | null = 120_000) {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
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
    // SPEC-449: un perfil ACTIVO **sin** verificación aprobada vigente no existe
    // en producción — el estado lo escribe la aprobación, y `venceEn` es lo que
    // la Ley 2375/2024 obliga a revalidar. Este fixture lo sembraba así y pasaba
    // solo porque la consulta vieja no miraba la vigencia; `obtenerPublicoPorId`
    // ahora sí. Se endurece el fixture, NO se afloja el guard: aflojarlo dejaría
    // agendando a un profesional con los antecedentes caducados.
    const revisor = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    });
    return perfil;
}

async function seedFranja(profesionalId: string, offsetDias = 3) {
    const inicio = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin, modalidad: "VIRTUAL", tomada: false },
    });
}

async function pedir(padreId: string, proId: string, offsetDias = 3) {
    const franja = await seedFranja(proId, offsetDias);
    return crearSolicitudCita({
        padreUsuarioId: padreId,
        profesionalId: proId,
        franjaId: franja.id,
        presentacion: "Mi hija recibe mensajes que la asustan, quiero orientación.",
        urgencia: "SIN_APURO",
        porcentajeServicio: 10,
        montoConsultaOverride: 50_000,
    });
}

async function primeraEn(estado: EstadoSolicitudCita) {
    const padre = await crearUsuario("PARENT");
    const pro = await seedProfesional(120_000);
    const primera = await pedir(padre.id, pro.id);
    await prisma.solicitudCita.update({ where: { id: primera.id }, data: { estado } });
    return { padre, pro };
}

describe("SPEC-940 · PI intermedia solo la 1.ª cita con cada profesional", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    for (const estado of ["CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"] as const) {
        it(`2.ª con el MISMO profesional tras una ${estado} → 409 en el servidor, nada se crea`, async () => {
            const { padre, pro } = await primeraEn(estado);
            const antes = await prisma.solicitudCita.count();
            const franjasLibres = await prisma.franjaDisponible.count({ where: { tomada: false } });

            // Una sola llamada (cada `pedir` crea una franja): 409 + el fragmento INVARIANTE del canal (el mensaje
            // interpola el nombre del profesional, FORMA §a).
            const err = (await pedir(padre.id, pro.id, 5).catch((e: unknown) => e)) as { statusCode?: number; message?: string };
            expect(err.statusCode).toBe(409);
            expect(err.message).toContain(FRAGMENTO_SEGUNDA_CITA_CANAL);
            expect(await prisma.solicitudCita.count()).toBe(antes);
            // La franja nueva (creada por `pedir`) sigue libre: el rechazo es ANTES de tomarla.
            expect(await prisma.franjaDisponible.count({ where: { tomada: false } })).toBe(franjasLibres + 1);
        });
    }

    for (const estado of ["VENCIDA_SIN_RESPUESTA", "REEMBOLSADA"] as const) {
        it(`tras una que NO prosperó (${estado}) → se puede volver a pedir`, async () => {
            const { padre, pro } = await primeraEn(estado);
            const nueva = await pedir(padre.id, pro.id, 5);
            expect(nueva.profesionalId).toBe(pro.id);
        });
    }

    it("1.ª con OTRO profesional → permitida aunque tenga una confirmada con el primero", async () => {
        const { padre } = await primeraEn("CONFIRMADA");
        const otro = await seedProfesional(90_000);
        const nueva = await pedir(padre.id, otro.id, 5);
        expect(nueva.profesionalId).toBe(otro.id);
    });

    it("tras una CONFIRMADA: crear con ese profesional → 409, PERO reprogramar esa cita → OK (no se funden las rutas)", async () => {
        // SPEC-940 (hallazgo 1, VEREDICTO CEO): la reprogramación va por `reprogramarPorPadre` (pago heredado),
        // NO por `crearSolicitudCita`. El 409 de la 2.ª cita no debe tocarla.
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional(120_000);
        const primera = await pedir(padre.id, pro.id, 3);
        // Dejarla CONFIRMADA (pago aprobado + confirmada por el profesional) para que sea reprogramable.
        await prisma.solicitudCita.update({ where: { id: primera.id }, data: { estado: "CONFIRMADA", pagoAprobadoEn: new Date() } });

        // Pedir OTRA cita con el mismo profesional por la vía normal → bloqueada.
        await expect(pedir(padre.id, pro.id, 5)).rejects.toMatchObject({ statusCode: 409 });

        // Reprogramar la confirmada → permitida (fila nueva que HEREDA el pago).
        const nuevaFranja = await seedFranja(pro.id, 7);
        const reprogramada = await reprogramarPorPadre({
            padreUsuarioId: padre.id,
            solicitudId: primera.id,
            nuevaFranjaId: nuevaFranja.id,
        });
        expect(reprogramada.profesionalId).toBe(pro.id);
        expect(reprogramada.pagoHeredadoDeId).toBe(primera.id);
        expect((await prisma.solicitudCita.findUniqueOrThrow({ where: { id: primera.id } })).estado).toBe("REPROGRAMADA");
    });

    it("otro PADRE con el mismo profesional → permitido (la regla es por dupla padre × profesional)", async () => {
        const { pro } = await primeraEn("CONFIRMADA");
        const otroPadre = await crearUsuario("PARENT");
        const nueva = await pedir(otroPadre.id, pro.id, 5);
        expect(nueva.padreUsuarioId).toBe(otroPadre.id);
    });

    it("ningún camino cobra la tarifa del profesional: tarifa 120.000 → se cobra el estándar 50.000 + 10 %", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional(120_000);
        const s = await pedir(padre.id, pro.id);
        expect(s.montoConsulta).toBe(50_000);
        expect(s.montoTotal).toBe(55_000);
    });

    it("INVARIANTE borde VENCIDO: con 1.ª cita CONFIRMADA pero perfil VENCIDO → NI bloqueado NI visible", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional(120_000);
        const primera = await pedir(padre.id, pro.id, 3);
        await prisma.solicitudCita.update({ where: { id: primera.id }, data: { estado: "CONFIRMADA" } });
        await prisma.perfilProfesional.update({ where: { id: pro.id }, data: { estado: "VENCIDO" } });

        // BLOQUEO alineado al predicado completo: un profesional VENCIDO NO cuenta → no bloquea (el padre igual no
        // puede agendar con un vencido: obtenerPublicoPorId lo filtra en crearSolicitudCita).
        const bloqueado = await new SolicitudCitaRepository().existeCitaConfirmadaConProfesional(padre.id, pro.id);
        expect(bloqueado, "vencido → NO bloqueado (invariante)").toBe(false);
        // VISIBLE = false también: override legal cierra el contacto aunque la cita esté CONFIRMADA.
        expect(debeExponerContacto({ estado: "CONFIRMADA", pagoAprobadoEn: new Date() }, new Date(), "VENCIDO")).toBe(false);
        // NI bloqueado NI visible → la invariante visible⟺bloqueado se mantiene en el borde.
    });
});
