/**
 * SPEC-832 · CANDADO del WRITE de reubicación (`reubicarCitaPorAdmin`). Dos invariantes de calendario que
 * HOY no existían (radicado), afirmadas sobre el RESULTADO real del write:
 *  (a) cada cita apunta a la franja de SU profesional — `cita.profesionalId == cita.franja.profesionalId`;
 *  (b) `franja.tomada` coincide con una solicitud ACTIVA — la de A queda LIBRE (su cita pasó a REUBICADA,
 *      terminal), la de B queda TOMADA (la cita nueva, activa).
 * Más la forma de la reubicación: fila nueva PAGADA_PENDIENTE que hereda el pago, origen → REUBICADA con la
 * prueba durable, y la ATOMICIDAD: si el destino ya no es válido, el write RECHAZA sin tocar el origen.
 * (SPEC-852 eliminó el eje REPS; el destino sigue validándose por `crearSolicitudCita`.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { reubicarCitaPorAdmin } from "./cita.service";

const DIA = 24 * 60 * 60 * 1000;
let bogotaId: string;

async function seedPro(opts: { nombre: string }) {
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: opts.nombre,
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA"],
            ciudadId: bogotaId,
            atiendeVirtual: true,
            atiendePresencial: true,
            aniosExperiencia: 5,
            presentacion: "Acompaña procesos con niñas, niños y adolescentes.",
            tarifaConsultaCOP: 100_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 2 * DIA),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `a-${perfil.id}`,
            venceEn: new Date(Date.now() + 90 * DIA),
        },
    });
    return perfil;
}

const W_INICIO = new Date(Date.now() + 3 * DIA);
const W_FIN = new Date(W_INICIO.getTime() + 50 * 60 * 1000);

async function seedFranja(profesionalId: string, tomada: boolean, modalidad: "VIRTUAL" | "PRESENCIAL" = "VIRTUAL") {
    return prisma.franjaDisponible.create({
        data: { profesionalId, inicio: W_INICIO, fin: W_FIN, modalidad, tomada },
    });
}

async function seedCitaConfirmada(profesionalId: string, franjaId: string, padreId: string) {
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId,
            franjaId,
            presentacion: "Relato de la familia.",
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
}

/** Escenario base: A con una cita CONFIRMADA (su franja tomada) + B ofrecible con una franja libre que solapa. */
async function escenario(opts: { modalidad?: "VIRTUAL" | "PRESENCIAL" } = {}) {
    const modalidad = opts.modalidad ?? "VIRTUAL";
    const padre = await crearUsuario("PARENT");
    const admin = await crearUsuario("ADMIN");
    const a = await seedPro({ nombre: "Prof. A (sale)" });
    const franjaA = await seedFranja(a.id, true, modalidad);
    const cita = await seedCitaConfirmada(a.id, franjaA.id, padre.id);
    const b = await seedPro({ nombre: "Prof. B (entra)" });
    const franjaB = await seedFranja(b.id, false, modalidad);
    return { padre, admin, a, franjaA, cita, b, franjaB };
}

describe("SPEC-832 · write de reubicación · invariantes de calendario", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        bogotaId = (await crearPaisCiudad()).ciudad.id;
    });

    it("(a) tras reubicar, cada cita apunta a la franja de SU profesional", async () => {
        const e = await escenario();
        const nueva = await reubicarCitaPorAdmin({
            adminId: e.admin.id,
            solicitudId: e.cita.id,
            nuevoProfesionalId: e.b.id,
            nuevaFranjaId: e.franjaB.id,
        });
        const nuevaConFranja = await prisma.solicitudCita.findUnique({ where: { id: nueva.id }, include: { franja: true } });
        const origenConFranja = await prisma.solicitudCita.findUnique({ where: { id: e.cita.id }, include: { franja: true } });
        expect(nuevaConFranja!.profesionalId).toBe(nuevaConFranja!.franja.profesionalId); // B == B
        expect(nuevaConFranja!.profesionalId).toBe(e.b.id);
        expect(origenConFranja!.profesionalId).toBe(origenConFranja!.franja.profesionalId); // A == A (sin tocar)
    });

    it("(b) la franja de A queda LIBRE (su cita es terminal); la de B queda TOMADA", async () => {
        const e = await escenario();
        await reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id });
        const franjaA = await prisma.franjaDisponible.findUnique({ where: { id: e.franjaA.id } });
        const franjaB = await prisma.franjaDisponible.findUnique({ where: { id: e.franjaB.id } });
        expect(franjaA!.tomada).toBe(false); // liberada: su cita pasó a REUBICADA (no activa)
        expect(franjaB!.tomada).toBe(true); // tomada por la cita nueva (activa)
    });

    it("origen → REUBICADA (terminal) con la prueba durable (reubicadaEnId/Por/En)", async () => {
        const e = await escenario();
        const nueva = await reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id });
        const origen = await prisma.solicitudCita.findUnique({ where: { id: e.cita.id } });
        expect(origen!.estado).toBe("REUBICADA");
        expect(origen!.reubicadaEnId).toBe(nueva.id);
        expect(origen!.reubicadaPorId).toBe(e.admin.id);
        expect(origen!.reubicadaEn).not.toBeNull();
    });

    it("la fila nueva HEREDA el pago y queda PAGADA_PENDIENTE (B puede rechazar → camino de reasignación)", async () => {
        const e = await escenario();
        const nueva = await reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id });
        expect(nueva.estado).toBe("PAGADA_PENDIENTE");
        expect(nueva.montoTotal).toBe(115_000); // heredado del original, no recobrado
        expect(nueva.solicitudPreviaId).toBe(e.cita.id);
    });

    it("ATOMICIDAD · si el destino ya no es válido (su franja fue tomada entre ver y confirmar) → RECHAZA y el origen NO se toca", async () => {
        // La franja de B se tomó entre que el admin la vio y confirmó → `crearSolicitudCita` la rechaza ANTES
        // de tocar el origen (orden deliberado: primero la fila nueva, el origen solo si B calza).
        const e = await escenario();
        await prisma.franjaDisponible.update({ where: { id: e.franjaB.id }, data: { tomada: true } });
        await expect(
            reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id }),
        ).rejects.toThrow();
        // Y el origen NO se tocó: sigue CONFIRMADA con su franja TOMADA (no se reubicó a un destino inválido).
        const origen = await prisma.solicitudCita.findUnique({ where: { id: e.cita.id } });
        expect(origen!.estado).toBe("CONFIRMADA");
        expect((await prisma.franjaDisponible.findUnique({ where: { id: e.franjaA.id } }))!.tomada).toBe(true);
    });

    it("GUARDAS: solo CONFIRMADA, y a OTRO profesional", async () => {
        const e = await escenario();
        // mismo profesional → rechaza
        await expect(
            reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.a.id, nuevaFranjaId: e.franjaB.id }),
        ).rejects.toThrow();
        // cita no confirmada → rechaza
        await prisma.solicitudCita.update({ where: { id: e.cita.id }, data: { estado: "CUMPLIDA" } });
        await expect(
            reubicarCitaPorAdmin({ adminId: e.admin.id, solicitudId: e.cita.id, nuevoProfesionalId: e.b.id, nuevaFranjaId: e.franjaB.id }),
        ).rejects.toThrow();
    });
});
