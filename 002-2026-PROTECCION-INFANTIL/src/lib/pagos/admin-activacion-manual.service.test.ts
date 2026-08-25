/**
 * SPEC-245 (002-PI-148): tests de integración de activación manual de suscripción.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addMonths } from "date-fns";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, OrigenSuscripcion, MetodoPagoManual } from "@prisma/client";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";
import { activarSuscripcionManual } from "./admin-activacion-manual.service";
import { mesesDeDuracion } from "./freemium-calculos";

async function crearPlanPadre(adminId: string, duracion: DuracionPlan = DuracionPlan.MES_3) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion,
        anio: new Date().getFullYear(),
        nombre: `Plan Padre ${duracion}`,
        precioBaseUSD: 10,
        precioBaseCOP: 100_000,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

async function crearPlanColegio(adminId: string, duracion: DuracionPlan = DuracionPlan.MES_12) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion,
        anio: new Date().getFullYear(),
        nombre: `Plan Colegio ${duracion}`,
        precioBaseUSD: 100,
        precioBaseCOP: 400_000,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

describe("activarSuscripcionManual", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea una suscripción ACTIVA para un padre con origen ACTIVADA_MANUAL_ADMIN", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);

        const suscripcion = await activarSuscripcionManual({
            adminId: admin.id,
            target: { tipoTitular: TipoTitular.PADRE, usuarioId: padre.id },
            planId: plan.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-123",
            montoRealPagado: 119_000,
        });

        expect(suscripcion.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(suscripcion.origen).toBe(OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN);
        expect(suscripcion.autorizadoPorAdminId).toBe(admin.id);
        expect(suscripcion.planActualId).toBe(plan.id);
        expect(suscripcion.usuarioId).toBe(padre.id);
        expect(suscripcion.metodoPagoManual).toBe(MetodoPagoManual.TRANSFERENCIA_BANCARIA);
        expect(suscripcion.referenciaPagoManual).toBe("REF-123");
        expect(suscripcion.montoRealPagado).toBe(119_000);

        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "Suscripcion", recursoId: suscripcion.id },
        });
        expect(audit).not.toBeNull();
    });

    it("calcula fechaFin sumando la duración del plan a fechaInicio", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id, DuracionPlan.MES_6);

        const fechaPagoReal = new Date("2026-08-25T00:00:00-05:00");
        const suscripcion = await activarSuscripcionManual({
            adminId: admin.id,
            target: { tipoTitular: TipoTitular.PADRE, usuarioId: padre.id },
            planId: plan.id,
            metodoPagoManual: MetodoPagoManual.EFECTIVO,
            referenciaPagoManual: "EFECT-1",
            montoRealPagado: 200_000,
            fechaPagoReal,
        });

        const esperadoFin = addMonths(fechaPagoReal, mesesDeDuracion(DuracionPlan.MES_6));
        expect(suscripcion.fechaInicio.toISOString()).toBe(fechaPagoReal.toISOString());
        expect(suscripcion.fechaFin.toISOString()).toBe(esperadoFin.toISOString());
    });

    it("rechaza activar un plan freemium", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: new Date().getFullYear(),
            nombre: "Freemium",
            precioBaseUSD: 0,
            precioBaseCOP: 0,
            precio: 0,
            esFreemium: true,
            usosMaximosPorCliente: 1,
            creadoPorAdminId: admin.id,
        });

        await expect(
            activarSuscripcionManual({
                adminId: admin.id,
                target: { tipoTitular: TipoTitular.PADRE, usuarioId: padre.id },
                planId: plan.id,
                metodoPagoManual: MetodoPagoManual.OTRO,
                referenciaPagoManual: "X",
                montoRealPagado: 0,
            })
        ).rejects.toMatchObject({ statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR });
    });

    it("rechaza si el plan no coincide con el tipo de titular", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const { colegio } = await crearColegioConAdmin();
        const planPadre = await crearPlanPadre(admin.id);

        await expect(
            activarSuscripcionManual({
                adminId: admin.id,
                target: { tipoTitular: TipoTitular.COLEGIO, colegioId: colegio.id },
                planId: planPadre.id,
                metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
                referenciaPagoManual: "REF",
                montoRealPagado: 100_000,
            })
        ).rejects.toMatchObject({ statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR });
    });

    it("rechaza si el titular ya tiene una suscripción vigente", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);

        await prisma.suscripcion.create({
            data: {
                tipoTitular: TipoTitular.PADRE,
                usuarioId: padre.id,
                planActualId: plan.id,
                estado: EstadoSuscripcion.ACTIVA,
                origen: OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN,
                esFreemium: false,
                fechaInicio: new Date(),
                fechaFin: addMonths(new Date(), 3),
                monedaLocal: "COP",
                paisCliente: "CO",
                codigoReferidoPropio: `ref-${Date.now()}`,
            },
        });

        await expect(
            activarSuscripcionManual({
                adminId: admin.id,
                target: { tipoTitular: TipoTitular.PADRE, usuarioId: padre.id },
                planId: plan.id,
                metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
                referenciaPagoManual: "REF",
                montoRealPagado: 100_000,
            })
        ).rejects.toMatchObject({ statusCode: 409, code: ERROR_CODES.CONFLICT });
    });

    it("crea una suscripción ACTIVA para un colegio", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const { colegio } = await crearColegioConAdmin();
        const plan = await crearPlanColegio(admin.id);

        const suscripcion = await activarSuscripcionManual({
            adminId: admin.id,
            target: { tipoTitular: TipoTitular.COLEGIO, colegioId: colegio.id },
            planId: plan.id,
            metodoPagoManual: MetodoPagoManual.CHEQUE,
            referenciaPagoManual: "CH-999",
            montoRealPagado: 400_000,
        });

        expect(suscripcion.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(suscripcion.colegioId).toBe(colegio.id);
        expect(suscripcion.origen).toBe(OrigenSuscripcion.ACTIVADA_MANUAL_ADMIN);
    });
});
