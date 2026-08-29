/**
 * SPEC-239 (002-PI-mega-cola): tests de integración de
 * ContactoEmergenciaRepository y de ExpedienteMotorRepository.marcarEscaladoRojo
 * (T006): CRUD acotado al padre, orden por prioridad, baja lógica y
 * anti cross-user leak (SC-001).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ContactoEmergenciaRepository } from "./contacto-emergencia";
import { ExpedienteMotorRepository } from "./expediente-motor-repository";

async function crearExpediente(padreId: string, overrides: Record<string, unknown> = {}) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57302${Math.floor(Math.random() * 1000000)}`,
            fechaApertura: new Date(),
            estado: "ACTIVO",
            numEventos: 1,
            ...overrides,
        } as never,
    });
}

describe("ContactoEmergenciaRepository (SPEC-239)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("crea y lista contactos activos ordenados por prioridad ASC (US1.4)", async () => {
        const padre = await crearUsuario("PARENT");
        const repo = new ContactoEmergenciaRepository();
        await repo.crear({ padreUsuarioId: padre.id, nombre: "Tercero", relacion: "OTRO", telefono: "+573001111113", prioridad: 3 });
        await repo.crear({ padreUsuarioId: padre.id, nombre: "Primero", relacion: "MADRE", telefono: "+573001111111", prioridad: 1 });
        await repo.crear({ padreUsuarioId: padre.id, nombre: "Segundo", relacion: "PADRE", telefono: "+573001111112", prioridad: 2 });

        const activos = await repo.findActivosPorPadre(padre.id);
        expect(activos.map((c) => c.prioridad)).toEqual([1, 2, 3]);
        expect(activos[0]?.nombre).toBe("Primero");
    });

    it("listarPorPadre pagina y excluye inactivos por defecto (US1.3)", async () => {
        const padre = await crearUsuario("PARENT");
        const repo = new ContactoEmergenciaRepository();
        const c1 = await repo.crear({ padreUsuarioId: padre.id, nombre: "Uno", relacion: "TUTOR", telefono: "+573001111111", prioridad: 1 });
        await repo.crear({ padreUsuarioId: padre.id, nombre: "Dos", relacion: "HERMANO", telefono: "+573001111112", prioridad: 2 });
        await repo.desactivar(c1.id);

        const soloActivos = await repo.listarPorPadre(padre.id);
        expect(soloActivos.total).toBe(1);
        expect(soloActivos.items[0]?.nombre).toBe("Dos");

        const todos = await repo.listarPorPadre(padre.id, { soloActivos: false });
        expect(todos.total).toBe(2);
    });

    it("findByIdAndPadre devuelve null para contacto ajeno (cross-user leak, SC-001)", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const repo = new ContactoEmergenciaRepository();
        const contacto = await repo.crear({ padreUsuarioId: padre.id, nombre: "Propio", relacion: "MADRE", telefono: "+573001111111", prioridad: 1 });

        expect(await repo.findByIdAndPadre(contacto.id, padre.id)).not.toBeNull();
        expect(await repo.findByIdAndPadre(contacto.id, otro.id)).toBeNull();
    });

    it("actualizar modifica solo campos permitidos y desactivar conserva la fila (D3)", async () => {
        const padre = await crearUsuario("PARENT");
        const repo = new ContactoEmergenciaRepository();
        const contacto = await repo.crear({ padreUsuarioId: padre.id, nombre: "Original", relacion: "MADRE", telefono: "+573001111111", prioridad: 1 });

        const actualizado = await repo.actualizar(contacto.id, { telefono: "+573009876543", prioridad: 2 });
        expect(actualizado.telefono).toBe("+573009876543");
        expect(actualizado.prioridad).toBe(2);
        expect(actualizado.nombre).toBe("Original");

        await repo.desactivar(contacto.id);
        const conservado = await prisma.contactoEmergencia.findUnique({ where: { id: contacto.id } });
        expect(conservado).not.toBeNull();
        expect(conservado?.activo).toBe(false);
        expect(await repo.findActivosPorPadre(padre.id)).toHaveLength(0);
    });
});

describe("ExpedienteMotorRepository.marcarEscaladoRojo (SPEC-239, FR-003)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("fija score ROJO, SLA efectivo, fecha de escalamiento y estado compatible", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        const ahora = new Date("2026-08-24T15:00:00.000Z");

        const actualizado = await new ExpedienteMotorRepository().marcarEscaladoRojo(exp.id, {
            estado: "PENDIENTE_COMITE",
            slaEfectivoHoras: 12,
            fechaEscaladoRojoEn: ahora,
        });

        expect(actualizado.scoreGravedadActual).toBe("ROJO");
        expect(actualizado.estado).toBe("PENDIENTE_COMITE");
        expect(actualizado.slaEfectivoHoras).toBe(12);
        expect(actualizado.fechaEscaladoRojoEn?.toISOString()).toBe(ahora.toISOString());
    });

    it("actualiza solo campos dados: sin estado conserva el vigente", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id, { estado: "EN_APROBACION_PADRE" });

        const actualizado = await new ExpedienteMotorRepository().marcarEscaladoRojo(exp.id, {
            slaEfectivoHoras: 12,
        });

        expect(actualizado.scoreGravedadActual).toBe("ROJO");
        expect(actualizado.estado).toBe("EN_APROBACION_PADRE");
    });

    it("listarRojosEnVigilanciaSla filtra ROJO en estados vigilados con fecha de escalamiento", async () => {
        const padre = await crearUsuario("PARENT");
        const ahora = new Date();
        const vigilado = await crearExpediente(padre.id, {
            estado: "PENDIENTE_COMITE",
            scoreGravedadActual: "ROJO",
            fechaEscaladoRojoEn: ahora,
        });
        await crearExpediente(padre.id, { estado: "ACTIVO", scoreGravedadActual: "ROJO", fechaEscaladoRojoEn: ahora });
        await crearExpediente(padre.id, { estado: "PENDIENTE_COMITE", scoreGravedadActual: "AMARILLO" });
        await crearExpediente(padre.id, { estado: "PENDIENTE_COMITE", scoreGravedadActual: "ROJO" });

        const lista = await new ExpedienteMotorRepository().listarRojosEnVigilanciaSla();
        expect(lista.map((e) => e.id)).toEqual([vigilado.id]);
    });
});
