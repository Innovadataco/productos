/**
 * SPEC-395/657 (L4) — el worker del vencimiento 48h: cuando el profesional deja
 * pasar sus 48 h sobre una cita YA PAGADA, la marca VENCIDA_SIN_RESPUESTA, libera
 * la franja y registra `CITA_PROFESIONAL_VENCIDA_PROFESIONAL` (el hecho veraz).
 *
 * Idempotencia (SPEC-657): la da la transición one-way de estado, NO un audit.
 * `listarVencidasSinAvisar48h` filtra por `estado: PAGADA_PENDIENTE`; al vencer,
 * la cita sale del conjunto de candidatas para siempre, así que la vuelta
 * siguiente del cron no la reprocesa. Antes había un skip que comparaba
 * `AuditLog.CITA_PROFESIONAL_AVISO_48H_ENVIADO.creadoEn` contra
 * `SolicitudCita.actualizadoEn`; defendía una repetición que la máquina de
 * estados ya hace imposible — se quitó en SPEC-657. Ese audit además mentía:
 * decía ENVIADO y nada se enviaba (I-385), por eso hay un candado abajo que
 * verifica que NO vuelva a escribirse.
 *
 * También verificamos el segundo pilar: la franja se LIBERA cuando el
 * profesional deja pasar las 48h (para que otro padre la pueda tomar).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { barrerAvisoVencimiento48h, barrerPlazoPagoDelPadre } from "./worker";

async function seedProfesional() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Rodríguez",
            tituloProfesional: "Psicóloga clínica",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 8,
            presentacion: "Trabaja con niños entre 6 y 12 años.",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
}

async function seedFranja(profesionalId: string, offsetDias = 3) {
    const inicio = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: {
            profesionalId,
            inicio,
            fin,
            modalidad: "VIRTUAL",
            tomada: true,
        },
    });
}

async function seedSolicitudPagadaPendiente(
    padreId: string,
    profesionalId: string,
    franjaId: string,
    pagoAprobadoEn: Date
) {
    // Necesitamos que `actualizadoEn` quede en el momento del pago (o antes),
    // para que el worker actual — que corre "ahora" — vea `now - actualizadoEn`
    // pasado los 48h. Prisma escribe `actualizadoEn = now` en el `create`; se
    // fuerza con un update explícito.
    const s = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId,
            franjaId,
            presentacion: "Buenas, mi hija está teniendo pesadillas.",
            urgencia: "SIN_APURO",
            estado: "PAGADA_PENDIENTE",
            venceEn: new Date(pagoAprobadoEn.getTime() + 72 * 60 * 60 * 1000),
            pagoAprobadoEn,
            montoConsulta: 120000,
            montoServicio: 18000,
            montoTotal: 138000,
            porcentajeServicio: 15,
        },
    });
    return prisma.solicitudCita.update({
        where: { id: s.id },
        data: { actualizadoEn: pagoAprobadoEn },
    });
}

async function seedSolicitudSinConfirmarPlazoVencido(
    padreId: string,
    profesionalId: string,
    franjaId: string
) {
    const hace73h = new Date(Date.now() - 73 * 60 * 60 * 1000);
    const venceEn = new Date(Date.now() - 1 * 60 * 60 * 1000); // vence hace 1h
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId,
            franjaId,
            presentacion: "Buenas, quisiera agendar consulta.",
            urgencia: "SIN_APURO",
            estado: "SIN_CONFIRMAR",
            venceEn,
            pagoAprobadoEn: null,
            montoConsulta: 120000,
            montoServicio: 18000,
            montoTotal: 138000,
            porcentajeServicio: 15,
            creadoEn: hace73h,
        },
    });
}

describe("SPEC-395/657 · barrerAvisoVencimiento48h · vencimiento + idempotencia por estado", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("dos corridas seguidas → un solo audit VENCIDA_PROFESIONAL (idempotencia por estado)", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace49h = new Date(Date.now() - 49 * 60 * 60 * 1000);
        const solicitud = await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace49h);

        const r1 = await barrerAvisoVencimiento48h();
        const r2 = await barrerAvisoVencimiento48h();

        expect(r1.vencidas).toBe(1);
        // Segunda vuelta: la solicitud ya no está PAGADA_PENDIENTE (pasó a
        // VENCIDA_SIN_RESPUESTA), así que ni siquiera aparece como candidata.
        // La idempotencia la da la transición one-way de estado, NO un audit
        // (SPEC-657: se quitó el skip por `AVISO_48H_ENVIADO`, que defendía una
        // transición que la máquina de estados ya hace imposible). La cita nunca
        // se procesa dos veces en su misma vida.
        expect(r2.vencidas).toBe(0);

        const audits = await prisma.auditLog.findMany({
            where: { accion: "CITA_PROFESIONAL_VENCIDA_PROFESIONAL", recursoId: solicitud.id },
        });
        expect(audits, "el vencimiento se registra una única vez").toHaveLength(1);

        // La solicitud quedó vencida y la franja liberada.
        const solTras = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(solTras?.estado).toBe("VENCIDA_SIN_RESPUESTA");
        const franjaTras = await prisma.franjaDisponible.findUnique({ where: { id: franja.id } });
        expect(franjaTras?.tomada, "la franja se libera para que otro padre la tome").toBe(false);
    });

    it("no escribe el audit mentiroso AVISO_48H_ENVIADO — nada se le avisó al padre (I-385)", async () => {
        // El barredor todavía NO avisa (aviso en espera de política de reembolso,
        // Jelkin). El audit que existía, `..._AVISO_48H_ENVIADO`, afirmaba un
        // envío que nunca ocurrió; este candado impide que vuelva.
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace49h = new Date(Date.now() - 49 * 60 * 60 * 1000);
        const solicitud = await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace49h);

        await barrerAvisoVencimiento48h();

        const avisos = await prisma.auditLog.findMany({
            where: { accion: "CITA_PROFESIONAL_AVISO_48H_ENVIADO", recursoId: solicitud.id },
        });
        expect(avisos, "no puede haber audit de aviso: nada se envió").toHaveLength(0);
    });

    it("una solicitud PAGADA_PENDIENTE con < 48h desde el pago NO se vence", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace10h = new Date(Date.now() - 10 * 60 * 60 * 1000);
        await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace10h);

        const r = await barrerAvisoVencimiento48h();
        expect(r.vencidas).toBe(0);
    });
});

describe("SPEC-395 · barrerPlazoPagoDelPadre · libera franja al vencer", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("SIN_CONFIRMAR con venceEn pasado → estado vencido, franja libre, audit CITA_PROFESIONAL_PAGO_EXPIRADA", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const solicitud = await seedSolicitudSinConfirmarPlazoVencido(padre.id, pro.id, franja.id);

        const r = await barrerPlazoPagoDelPadre();
        expect(r.expiradas).toBe(1);
        expect(r.franjasLiberadas).toBe(1);

        const solTras = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(solTras?.estado).toBe("VENCIDA_SIN_RESPUESTA");
        const franjaTras = await prisma.franjaDisponible.findUnique({ where: { id: franja.id } });
        expect(franjaTras?.tomada, "el candado del CEO 09:50 exige que la franja quede libre").toBe(false);

        const audits = await prisma.auditLog.findMany({
            where: { accion: "CITA_PROFESIONAL_PAGO_EXPIRADA", recursoId: solicitud.id },
        });
        expect(audits).toHaveLength(1);
    });
});
