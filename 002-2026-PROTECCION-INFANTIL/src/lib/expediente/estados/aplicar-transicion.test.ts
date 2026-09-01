/**
 * SPEC-236 (002-PI-mega-cola): tests de integración del aplicador de
 * transiciones (FR-002 a FR-011). Comparten la PostgreSQL de test del repo
 * (fileParallelism: false); seed en beforeEach y cleanup con resetDatabase.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { aplicarTransicion, MOTIVO_AUTO_CIERRE_INACTIVIDAD } from "./aplicar-transicion";

// Motor Notif no debe frenar la transición: se simula la API estricta.
vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

const MIN_EVENTOS = 2;

async function seedParametros() {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.expediente.consolidacion_min_reportes" },
        update: { valor: String(MIN_EVENTOS) },
        create: {
            clave: "padre.expediente.consolidacion_min_reportes",
            valor: String(MIN_EVENTOS),
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.expediente.auto_cierre_meses" },
        update: { valor: "6" },
        create: {
            clave: "padre.expediente.auto_cierre_meses",
            valor: "6",
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

async function crearExpedientePrueba(
    padreId: string,
    overrides: Partial<{
        estado: EstadoExpediente;
        numEventos: number;
        ultimoEventoEn: Date;
        fechaApertura: Date;
    }> = {}
) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Date.now() % 10000000)}`,
            fechaApertura: overrides.fechaApertura ?? new Date(),
            estado: overrides.estado ?? EstadoExpediente.ACTIVO,
            numEventos: overrides.numEventos ?? 0,
            ultimoEventoEn: overrides.ultimoEventoEn ?? new Date(),
        },
    });
}

async function crearInforme(expedienteId: string, estadoAprobacion = "PENDIENTE_COMITE") {
    return prisma.informeConsolidado.create({
        data: {
            expedienteId,
            versionSecuencial: 1,
            scoreValor: 10,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: {},
            resumenTextoGenerado: "resumen",
            estadoAprobacion,
        },
    });
}

describe("aplicarTransicion (SPEC-236)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametros();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("ACTIVO → CONSOLIDANDO con eventos suficientes persiste y audita (US1.1)", async () => {
        const padre = await crearUsuario("PARENT");
        const admin = await crearUsuario("ADMIN");
        const exp = await crearExpedientePrueba(padre.id, { numEventos: MIN_EVENTOS });

        const actualizado = await aplicarTransicion({
            expedienteId: exp.id,
            estadoDestino: EstadoExpediente.CONSOLIDANDO,
            motivo: "Suficientes eventos",
            actor: { id: admin.id, tipo: "usuario", rol: "ADMIN" },
        });

        expect(actualizado.estado).toBe(EstadoExpediente.CONSOLIDANDO);
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_TRANSICION_ESTADO", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toBe("ACTIVO");
        expect(audit?.valorNuevo).toBe("CONSOLIDANDO");
    });

    it("ACTIVO → CONSOLIDANDO sin eventos suficientes lanza 409 (US1.2)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { numEventos: 0 });

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.CONSOLIDANDO,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        const sinCambio = await prisma.expediente.findUnique({ where: { id: exp.id } });
        expect(sinCambio?.estado).toBe(EstadoExpediente.ACTIVO);
    });

    it("CONSOLIDANDO → PENDIENTE_COMITE con informe permite (US1.3)", async () => {
        const padre = await crearUsuario("PARENT");
        const admin = await crearUsuario("ADMIN");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.CONSOLIDANDO });
        await crearInforme(exp.id);

        const actualizado = await aplicarTransicion({
            expedienteId: exp.id,
            estadoDestino: EstadoExpediente.PENDIENTE_COMITE,
            actor: { id: admin.id, tipo: "usuario", rol: "ADMIN" },
        });
        expect(actualizado.estado).toBe(EstadoExpediente.PENDIENTE_COMITE);
    });

    it("CONSOLIDANDO → PENDIENTE_COMITE sin informe rechaza con 409 (US1.4)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.CONSOLIDANDO });

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.PENDIENTE_COMITE,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("PENDIENTE_COMITE → EN_APROBACION_PADRE exige informe APROBADO (US1.5)", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.PENDIENTE_COMITE });
        await crearInforme(exp.id, "PENDIENTE_COMITE");

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.EN_APROBACION_PADRE,
                actor: { id: comite.id, tipo: "usuario", rol: "COMITE_VALIDACION" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        // Aprobar el informe y reintentar.
        const informe = await prisma.informeConsolidado.findFirst({ where: { expedienteId: exp.id } });
        await prisma.informeConsolidado.update({
            where: { id: informe!.id },
            data: { estadoAprobacion: "APROBADO" },
        });

        const actualizado = await aplicarTransicion({
            expedienteId: exp.id,
            estadoDestino: EstadoExpediente.EN_APROBACION_PADRE,
            actor: { id: comite.id, tipo: "usuario", rol: "COMITE_VALIDACION" },
        });
        expect(actualizado.estado).toBe(EstadoExpediente.EN_APROBACION_PADRE);
    });

    it("EN_APROBACION_PADRE → EN_ACLARACION sin aclaración pendiente rechaza 409 (stub SPEC-238)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.EN_APROBACION_PADRE });

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.EN_ACLARACION,
                actor: { id: "comite", tipo: "usuario", rol: "COMITE_VALIDACION" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("EN_APROBACION_PADRE → CERRADO con aceptación del padre cierra y marca fechaCierre (US1.8)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.EN_APROBACION_PADRE });

        const actualizado = await aplicarTransicion({
            expedienteId: exp.id,
            estadoDestino: EstadoExpediente.CERRADO,
            motivo: "Aceptación del padre",
            actor: { id: padre.id, tipo: "usuario", rol: "PARENT" },
        });

        expect(actualizado.estado).toBe(EstadoExpediente.CERRADO);
        expect(actualizado.fechaCierre).not.toBeNull();
        expect(actualizado.autoCerradoPorInactividad).toBe(false);
    });

    it("EN_APROBACION_PADRE → CERRADO por admin sin aceptación ni aclaración rechaza 409", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.EN_APROBACION_PADRE });

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.CERRADO,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("CERRADO → * se rechaza con 403 (hard guard, US1.9)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.CERRADO });

        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.ACTIVO,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("CERRADO → ESCALADO por el padre titular reabre (US1.10)", async () => {
        const padre = await crearUsuario("PARENT");
        const otroPadre = await crearUsuario("PARENT");
        const exp = await crearExpedientePrueba(padre.id, { estado: EstadoExpediente.CERRADO });

        // Un padre que no es titular recibe 403.
        await expect(
            aplicarTransicion({
                expedienteId: exp.id,
                estadoDestino: EstadoExpediente.ESCALADO,
                actor: { id: otroPadre.id, tipo: "usuario", rol: "PARENT" },
            })
        ).rejects.toMatchObject({ statusCode: 403 });

        const actualizado = await aplicarTransicion({
            expedienteId: exp.id,
            estadoDestino: EstadoExpediente.ESCALADO,
            motivo: "Reapertura solicitada por el padre",
            actor: { id: padre.id, tipo: "usuario", rol: "PARENT" },
        });
        expect(actualizado.estado).toBe(EstadoExpediente.ESCALADO);
        expect(actualizado.fechaEscalado).not.toBeNull();
    });

    it("ACTIVO → CERRADO solo lo ejecuta el worker tras inactividad verificada (FR-009)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace7Meses = new Date();
        hace7Meses.setUTCMonth(hace7Meses.getUTCMonth() - 7);

        // Un usuario (no worker) no puede cerrar directo desde ACTIVO.
        const expActivo = await crearExpedientePrueba(padre.id, { ultimoEventoEn: hace7Meses });
        await expect(
            aplicarTransicion({
                expedienteId: expActivo.id,
                estadoDestino: EstadoExpediente.CERRADO,
                motivo: MOTIVO_AUTO_CIERRE_INACTIVIDAD,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        // SPEC-340 (D-1): NI el worker con expediente inactivo — la transición
        // quedó derogada incondicionalmente (afirmaba el cierre hasta 01-09).
        await expect(
            aplicarTransicion({
                expedienteId: expActivo.id,
                estadoDestino: EstadoExpediente.CERRADO,
                motivo: MOTIVO_AUTO_CIERRE_INACTIVIDAD,
                actor: { id: "worker-expediente-motor", tipo: "worker" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        // Y con expediente reciente, igual (la derogación no distingue).
        const expReciente = await crearExpedientePrueba(padre.id, { ultimoEventoEn: new Date() });
        await expect(
            aplicarTransicion({
                expedienteId: expReciente.id,
                estadoDestino: EstadoExpediente.CERRADO,
                motivo: MOTIVO_AUTO_CIERRE_INACTIVIDAD,
                actor: { id: "worker-expediente-motor", tipo: "worker" },
            })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("expediente inexistente lanza 404", async () => {
        await expect(
            aplicarTransicion({
                expedienteId: "no-existe",
                estadoDestino: EstadoExpediente.CONSOLIDANDO,
                actor: { id: "admin", tipo: "usuario", rol: "ADMIN" },
            })
        ).rejects.toMatchObject({ statusCode: 404 });
    });
});
