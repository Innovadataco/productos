/**
 * CANDADO · SPEC-658 (I-393) · la vista de admin lista EXACTAMENTE las citas donde el
 * padre PAGÓ y el profesional dejó pasar las 48 h (VENCIDA_SIN_RESPUESTA ∧
 * pagoAprobadoEn presente).
 *
 * Sostiene la ASIMETRÍA de D-137: el reembolso es SOLO por el silencio del PROFESIONAL,
 * NUNCA por el no-asistió del PADRE. Si esta consulta se aflojara —trayendo
 * NO_ASISTIO_PADRE, o las impagas— el producto mostraría como «plata por devolver» lo
 * que Jelkin decidió NO devolver, y un admin reembolsaría de más. Por eso el candado
 * siembra las poblaciones VECINAS y afirma que la consulta trae solo la correcta.
 *
 * Muere si el WHERE se afloja (quitar el filtro de pago, o incluir NO_ASISTIO_PADRE) →
 * rojo. Integración (BD de test, truncada).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { EstadoSolicitudCita } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

async function seedProfesional(ciudadId: string) {
    const usuario = await crearUsuario("PROFESIONAL", `pro.658.${Date.now()}.${Math.random()}@ejemplo.local`);
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. 658",
            tituloProfesional: "Psicología",
            especialidades: ["x"],
            ciudadId,
            atiendeVirtual: true,
            aniosExperiencia: 5,
            presentacion: "p",
            tarifaConsultaCOP: 120000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
}

async function sembrarCita(opts: { profesionalId: string; estado: EstadoSolicitudCita; pagado: boolean }) {
    const padre = await crearUsuario("PARENT", `padre.658.${Date.now()}.${Math.random()}@ejemplo.local`);
    const inicio = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const franja = await prisma.franjaDisponible.create({
        data: {
            profesionalId: opts.profesionalId,
            inicio,
            fin: new Date(inicio.getTime() + 50 * 60 * 1000),
            modalidad: "VIRTUAL",
            tomada: true,
        },
    });
    const creadoEn = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: opts.profesionalId,
            franjaId: franja.id,
            presentacion: "consulta",
            urgencia: "SIN_APURO",
            estado: opts.estado,
            venceEn: new Date(creadoEn.getTime() + 72 * 60 * 60 * 1000),
            pagoAprobadoEn: opts.pagado ? new Date(creadoEn.getTime() + 6 * 60 * 60 * 1000) : null,
            montoConsulta: 120000,
            montoServicio: 18000,
            montoTotal: 138000,
            porcentajeServicio: 15,
            creadoEn,
        },
    });
}

describe("SPEC-658 (I-393) · la vista de admin trae solo VENCIDA_SIN_RESPUESTA con pago", () => {
    const repo = new SolicitudCitaRepository();
    let profId: string;
    let target1: string;
    let target2: string;

    beforeEach(async () => {
        await resetDatabase();
        const { ciudad } = await crearPaisCiudad();
        profId = (await seedProfesional(ciudad.id)).id;
        // Objetivo: pagó y el profesional calló.
        target1 = (await sembrarCita({ profesionalId: profId, estado: "VENCIDA_SIN_RESPUESTA", pagado: true })).id;
        target2 = (await sembrarCita({ profesionalId: profId, estado: "VENCIDA_SIN_RESPUESTA", pagado: true })).id;
        // Vecinas que NO deben aparecer:
        await sembrarCita({ profesionalId: profId, estado: "NO_ASISTIO_PADRE", pagado: true }); // asimetría D-137
        await sembrarCita({ profesionalId: profId, estado: "VENCIDA_SIN_RESPUESTA", pagado: false }); // impaga
        await sembrarCita({ profesionalId: profId, estado: "CUMPLIDA", pagado: true }); // otro estado
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("trae EXACTAMENTE las VENCIDA_SIN_RESPUESTA con pago (las dos objetivo)", async () => {
        const ids = (await repo.listarVencidasConPagoParaAdmin()).map((c) => c.id).sort();
        expect(ids).toEqual([target1, target2].sort());
    });

    it("NO trae el no-asistió del PADRE aunque haya pagado (asimetría D-137)", async () => {
        const estados = (await repo.listarVencidasConPagoParaAdmin()).map((c) => c.estado);
        expect(estados, "NO_ASISTIO_PADRE no se reembolsa; no puede aparecer acá").not.toContain("NO_ASISTIO_PADRE");
        expect(new Set(estados)).toEqual(new Set(["VENCIDA_SIN_RESPUESTA"]));
    });

    it("NO trae las VENCIDA impagas (sin pago no hay plata que mirar)", async () => {
        const rows = await repo.listarVencidasConPagoParaAdmin();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((c) => c.pagoAprobadoEn !== null), "toda fila listada tiene pago aprobado").toBe(true);
    });
});
