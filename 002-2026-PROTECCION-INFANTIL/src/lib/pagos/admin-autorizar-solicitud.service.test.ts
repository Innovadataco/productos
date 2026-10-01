/**
 * SPEC-245 (002-PI-148): tests de integración de autorización de solicitudes
 * de suscripción pendientes.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addMonths } from "date-fns";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    OrigenSuscripcion,
    MetodoPagoManual,
} from "@prisma/client";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";
import { autorizarSolicitudPendiente } from "./admin-autorizar-solicitud.service";

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

async function crearSolicitudPendiente(padreId: string, planId: string) {
    return prisma.suscripcion.create({
        data: {
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padreId,
            planActualId: planId,
            estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
            origen: OrigenSuscripcion.SOLICITADA_CLIENTE,
            esFreemium: false,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000),
            monedaLocal: "COP",
            paisCliente: "CO",
            codigoReferidoPropio: `ref-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
    });
}

describe("autorizarSolicitudPendiente", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("autoriza una solicitud pendiente y calcula fechaFin según el plan", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id, DuracionPlan.MES_3);
        const solicitud = await crearSolicitudPendiente(padre.id, plan.id);

        const fechaPagoReal = new Date("2026-08-25T00:00:00-05:00");
        const suscripcion = await autorizarSolicitudPendiente({
            adminId: admin.id,
            suscripcionId: solicitud.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-AUTO",
            montoRealPagado: 119_000,
            fechaPagoReal,
        });

        expect(suscripcion.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect(suscripcion.autorizadoPorAdminId).toBe(admin.id);
        expect(suscripcion.metodoPagoManual).toBe(MetodoPagoManual.TRANSFERENCIA_BANCARIA);
        expect(suscripcion.referenciaPagoManual).toBe("REF-AUTO");
        expect(suscripcion.montoRealPagado).toBe(119_000);
        expect(suscripcion.fechaInicio.toISOString()).toBe(fechaPagoReal.toISOString());
        // SPEC-795: oráculo LITERAL. Antes se calculaba con el mismo `addMonths` del servicio →
        // tautológico, estructuralmente incapaz de fallar. 25-ago Bogotá + 3 meses = 25-nov Bogotá.
        expect(suscripcion.fechaFin.toISOString()).toBe("2026-11-25T05:00:00.000Z");

        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "Suscripcion", recursoId: suscripcion.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toContain(EstadoSuscripcion.PENDIENTE_AUTORIZACION);
        expect(audit?.valorNuevo).toContain(EstadoSuscripcion.ACTIVA);
    });

    // SPEC-795 · CANDADO de frontera + control positivo. `fechaPagoReal` cae en la ventana donde el
    // día UTC (31) difiere del día Bogotá (30), a fin de mes. El oráculo es un LITERAL. Con el
    // `addMonths` sobre el instante crudo (bug), el resultado sería 2026-04-30 — el servicio
    // Bogotá-aware da 2026-05-01. El test CAE si alguien revierte a sumar sobre el instante UTC.
    it("fechaFin: suma de meses CLAMPA en calendario Bogotá en la frontera UTC≠Bogotá (SPEC-795)", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-f-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-f-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id, DuracionPlan.MES_3);
        const solicitud = await crearSolicitudPendiente(padre.id, plan.id);

        const suscripcion = await autorizarSolicitudPendiente({
            adminId: admin.id,
            suscripcionId: solicitud.id,
            metodoPagoManual: MetodoPagoManual.TRANSFERENCIA_BANCARIA,
            referenciaPagoManual: "REF-FRONTERA",
            montoRealPagado: 119_000,
            fechaPagoReal: new Date("2026-01-31T02:00:00.000Z"), // 30-ene 21:00 Bogotá
        });

        expect(suscripcion.fechaFin.toISOString()).toBe("2026-05-01T02:00:00.000Z");
    });

    it("retorna 404 si la suscripción no existe", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);

        await expect(
            autorizarSolicitudPendiente({
                adminId: admin.id,
                suscripcionId: "does-not-exist",
                metodoPagoManual: MetodoPagoManual.EFECTIVO,
                referenciaPagoManual: "X",
                montoRealPagado: 1,
            })
        ).rejects.toMatchObject({ statusCode: 404, code: ERROR_CODES.NOT_FOUND });
    });

    it("retorna 409 si la solicitud ya no está pendiente", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
        const plan = await crearPlanPadre(admin.id);
        const solicitud = await prisma.suscripcion.create({
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
            autorizarSolicitudPendiente({
                adminId: admin.id,
                suscripcionId: solicitud.id,
                metodoPagoManual: MetodoPagoManual.EFECTIVO,
                referenciaPagoManual: "X",
                montoRealPagado: 1,
            })
        ).rejects.toMatchObject({ statusCode: 409, code: ERROR_CODES.CONFLICT });
    });
});
