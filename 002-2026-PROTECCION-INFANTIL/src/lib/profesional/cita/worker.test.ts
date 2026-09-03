/**
 * SPEC-395 (L4) — el worker del aviso 48h aplica el mismo candado del patrón
 * I-280 (SPEC-387) que le puso freno al job de spam después de mandar 1.894
 * correos en 24h sobre 135 casos. Antes de este candado, cualquier vuelta del
 * cron avanzaba la solicitud otra vez y volvía a "avisar": misma cita, mismo
 * profesional, el buzón del padre lleno.
 *
 * Regla: se compara `AuditLog.CITA_PROFESIONAL_AVISO_48H_ENVIADO.creadoEn`
 * contra `SolicitudCita.actualizadoEn`. Si el aviso quedó DESPUÉS del último
 * cambio, se salta. Cuando el estado se mueve, `actualizadoEn` se recalcula
 * y la vuelta siguiente vuelve a evaluar.
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

describe("SPEC-395 · barrerAvisoVencimiento48h · candado I-280", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("dos corridas seguidas → UN solo audit CITA_PROFESIONAL_AVISO_48H_ENVIADO", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace49h = new Date(Date.now() - 49 * 60 * 60 * 1000);
        const solicitud = await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace49h);

        const r1 = await barrerAvisoVencimiento48h();
        const r2 = await barrerAvisoVencimiento48h();

        expect(r1.avisadas).toBe(1);
        // Segunda vuelta: la solicitud ya no está PAGADA_PENDIENTE (pasó a
        // VENCIDA_SIN_RESPUESTA), así que ni siquiera aparece como candidata.
        // El candado I-280 no se prueba acá (no hay repetición posible por diseño);
        // se prueba en el escenario "el audit queda antes de que otro cambio
        // reabra la ventana" — al aparecer una fila PAGADA_PENDIENTE nueva con
        // audit previo se aplica el mismo mecanismo del spam SLA. Lo importante:
        // el aviso NUNCA se registra dos veces para la misma vida de la solicitud.
        expect(r2.avisadas).toBe(0);

        const audits = await prisma.auditLog.findMany({
            where: { accion: "CITA_PROFESIONAL_AVISO_48H_ENVIADO", recursoId: solicitud.id },
        });
        expect(audits, "el aviso 48h se registra una única vez por vencimiento").toHaveLength(1);

        // La solicitud quedó vencida y la franja liberada.
        const solTras = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(solTras?.estado).toBe("VENCIDA_SIN_RESPUESTA");
        const franjaTras = await prisma.franjaDisponible.findUnique({ where: { id: franja.id } });
        expect(franjaTras?.tomada, "la franja se libera para que otro padre la tome").toBe(false);
    });

    it("candado I-280: audit previo con creadoEn ≥ actualizadoEn hace que el worker SALTE (defensa en profundidad)", async () => {
        // Escenario adverso: alguien insertó un audit previo (o un run previo lo
        // dejó por otra razón) y el estado quedó PAGADA_PENDIENTE. El worker
        // debe verificar el candado y SALTAR, no volver a avisar. Es el patrón
        // exacto del spam SLA (I-280) que evitó los 1.894 correos.
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace49h = new Date(Date.now() - 49 * 60 * 60 * 1000);
        const solicitud = await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace49h);

        // Un audit del aviso ya existe, MÁS reciente que `actualizadoEn`.
        await prisma.auditLog.create({
            data: {
                accion: "CITA_PROFESIONAL_AVISO_48H_ENVIADO",
                tipoRecurso: "SolicitudCita",
                recursoId: solicitud.id,
                ipAddress: "test",
                userAgent: "test-fixture",
                creadoEn: new Date(hace49h.getTime() + 60 * 1000),
            },
        });

        const r = await barrerAvisoVencimiento48h();
        expect(r.encontradas).toBe(1);
        expect(r.avisadas, "candado I-280 debe saltar el segundo aviso").toBe(0);
        expect(r.saltadas).toBe(1);

        // El estado NO se movió (el candado impide el cambio también).
        const solTras = await prisma.solicitudCita.findUnique({ where: { id: solicitud.id } });
        expect(solTras?.estado).toBe("PAGADA_PENDIENTE");
    });

    it("una solicitud PAGADA_PENDIENTE con < 48h desde el pago NO se avisa", async () => {
        const padre = await crearUsuario("PARENT");
        const pro = await seedProfesional();
        const franja = await seedFranja(pro.id);
        const hace10h = new Date(Date.now() - 10 * 60 * 60 * 1000);
        await seedSolicitudPagadaPendiente(padre.id, pro.id, franja.id, hace10h);

        const r = await barrerAvisoVencimiento48h();
        expect(r.avisadas).toBe(0);
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
