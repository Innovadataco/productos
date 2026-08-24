/**
 * SPEC-215 (002-PI-115): tests de integración del servicio de referidos
 * (generación única, recompensa al autorizar pago, tope anual y aviso del 4º uso).
 * Requieren PostgreSQL: los corre el coordinador con el gate de integración.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addMonths } from "date-fns";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    generarCodigoReferidoUnico,
    procesarRecompensasPagoAutorizado,
} from "./referido.service";
import { anioBogota } from "./renovacion-calculos";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoPago,
    EstadoSuscripcion,
    MetodoPago,
    TipoParametro,
    CategoriaParametro,
} from "@prisma/client";

async function crearSuscripcionPadre(
    email: string,
    overrides: { estado?: EstadoSuscripcion; codigoReferidoPropio?: string; fechaFin?: Date } = {}
) {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-sref-${Date.now()}-${Math.random()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, email);
    const planExistente = await repo.obtenerPlanPorClave(TipoTitular.PADRE, DuracionPlan.MES_1, 2026);
    const plan =
        planExistente ??
        (await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: 2026,
            nombre: "Plan padre mensual referidos svc",
            precioBaseUSD: 100,
            precio: 0,
            creadoPorAdminId: admin.id,
        }));
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: overrides.estado ?? EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: overrides.fechaFin ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: overrides.codigoReferidoPropio ?? `REF-SVC-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    return { admin, padre, plan, suscripcion };
}

async function crearPagoPendiente(suscripcionId: string, overrides: { codigoReferidoUsado?: string } = {}) {
    const repo = new PagosRepository();
    return repo.crearPago({
        suscripcionId,
        duracionCubierta: DuracionPlan.MES_1,
        montoBaseUSD: 100,
        descuentoAplicadoUSD: 0,
        montoNetoUSD: 100,
        tasaCambioAplicada: 4000,
        montoLocalPagado: 400000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "comprobantes/test.enc",
        comprobanteMimeType: "image/png",
        comprobanteHashSha256: `hash-${Date.now()}-${Math.random()}`,
        fechaReporte: new Date(),
        estado: EstadoPago.PENDIENTE_AUTORIZACION,
        ...(overrides.codigoReferidoUsado ? { codigoReferidoUsado: overrides.codigoReferidoUsado } : {}),
    });
}

async function seedParametroDescuento(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.referidos.descuento_referido_pct" },
        update: { valor },
        create: {
            clave: "pagos.referidos.descuento_referido_pct",
            valor,
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "test",
        },
    });
}

describe("generarCodigoReferidoUnico", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("genera códigos con formato válido por tipo de titular", async () => {
        const codigoColegio = await generarCodigoReferidoUnico(TipoTitular.COLEGIO);
        const codigoPadre = await generarCodigoReferidoUnico(TipoTitular.PADRE);
        expect(codigoColegio).toMatch(/^PI-COLEGIO-[A-HJ-NP-Z2-9]{8}$/);
        expect(codigoPadre).toMatch(/^PI-PADRE-[A-HJ-NP-Z2-9]{8}$/);
    });

    it("reintenta si el código generado ya existe (FR-003)", async () => {
        const { suscripcion } = await crearSuscripcionPadre(`colision-${Date.now()}@test.co`);
        // El código auto-generado ya está en BD: pedir otro debe devolver uno distinto.
        const nuevo = await generarCodigoReferidoUnico(TipoTitular.PADRE);
        expect(nuevo).not.toBe(suscripcion.codigoReferidoPropio);
        expect(nuevo).toMatch(/^PI-PADRE-[A-HJ-NP-Z2-9]{8}$/);
    });
});

describe("procesarRecompensasPagoAutorizado", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve null cuando la suscripción del pago no fue referida", async () => {
        const { admin, suscripcion } = await crearSuscripcionPadre(`sinref-${Date.now()}@test.co`);
        const pago = await crearPagoPendiente(suscripcion.id);

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, admin.id);

        expect(resumen).toBeNull();
    });

    it("activa el uso, descuenta el pago y otorga 1 mes gratis al referidor (FR-007)", async () => {
        await seedParametroDescuento("20");
        const repo = new PagosRepository();
        const fechaFinReferidor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const referidor = await crearSuscripcionPadre(`ref-ok-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-G7H8J9K2",
            fechaFin: fechaFinReferidor,
        });
        const referido = await crearSuscripcionPadre(`refdo-ok-${Date.now()}@test.co`);
        const uso = await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.suscripcion.id,
            suscripcionReferidaId: referido.suscripcion.id,
            anio: anioBogota(),
        });
        const pago = await crearPagoPendiente(referido.suscripcion.id);

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, referidor.admin.id);

        expect(resumen).not.toBeNull();
        expect(resumen?.recompensaOtorgada).toBe(true);
        expect(resumen?.descuentoAplicadoUSD).toBe(20);
        expect(resumen?.notificadoTopeAnual).toBe(false);

        const usoActualizado = await prisma.codigoReferidoUso.findUnique({ where: { id: uso.id } });
        expect(usoActualizado?.fechaActivacion).not.toBeNull();
        expect(usoActualizado?.recompensaOtorgada).toBe(true);
        expect(usoActualizado?.tipoRecompensa).toBe("MES_GRATIS_REFERIDOR");

        const pagoActualizado = await repo.obtenerPagoPorId(pago.id);
        expect(pagoActualizado?.descuentoAplicadoUSD).toBe(20);
        expect(pagoActualizado?.montoNetoUSD).toBe(80);
        expect(pagoActualizado?.montoLocalPagado).toBe(320000);
        expect(pagoActualizado?.codigoReferidoUsado).toBe("PI-PADRE-G7H8J9K2");

        const suscripcionReferidor = await repo.obtenerSuscripcionPorId(referidor.suscripcion.id);
        expect(suscripcionReferidor?.fechaFin.getTime()).toBe(addMonths(fechaFinReferidor, 1).getTime());

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REFERIDO_RECOMPENSA_OTORGADA", recursoId: uso.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(referidor.admin.id);
    });

    it("no recalcula el descuento si el pago ya traía código de referido (renovación SPEC-211)", async () => {
        await seedParametroDescuento("20");
        const repo = new PagosRepository();
        const referidor = await crearSuscripcionPadre(`ref-ya-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-H8J9K2L3",
        });
        const referido = await crearSuscripcionPadre(`refdo-ya-${Date.now()}@test.co`);
        await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.suscripcion.id,
            suscripcionReferidaId: referido.suscripcion.id,
            anio: anioBogota(),
        });
        const pago = await crearPagoPendiente(referido.suscripcion.id, {
            codigoReferidoUsado: "PI-PADRE-H8J9K2L3",
        });

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, referidor.admin.id);

        expect(resumen?.descuentoAplicadoUSD).toBe(0);
        const pagoActualizado = await repo.obtenerPagoPorId(pago.id);
        expect(pagoActualizado?.montoNetoUSD).toBe(100);
        expect(pagoActualizado?.montoLocalPagado).toBe(400000);
    });

    it("difiere la recompensa si el tope anual se alcanzó entre registro y activación (AS-005)", async () => {
        const repo = new PagosRepository();
        const referidor = await crearSuscripcionPadre(`ref-tope-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-J9K2L3M4",
        });
        const anio = anioBogota();
        // 5 referidos exitosos del año (tope por defecto) ya otorgados.
        for (let i = 0; i < 5; i++) {
            const otra = await crearSuscripcionPadre(`ref-tope-otra-${i}-${Date.now()}@test.co`);
            await repo.crearCodigoReferidoUso({
                codigoReferidoUsuarioId: referidor.suscripcion.id,
                suscripcionReferidaId: otra.suscripcion.id,
                anio,
                fechaActivacion: new Date(),
                recompensaOtorgada: true,
                recompensaOtorgadaEn: new Date(),
            });
        }
        const referido = await crearSuscripcionPadre(`refdo-tope-${Date.now()}@test.co`);
        const uso = await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.suscripcion.id,
            suscripcionReferidaId: referido.suscripcion.id,
            anio,
        });
        const pago = await crearPagoPendiente(referido.suscripcion.id);

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, referidor.admin.id);

        expect(resumen?.recompensaOtorgada).toBe(false);
        const usoActualizado = await prisma.codigoReferidoUso.findUnique({ where: { id: uso.id } });
        expect(usoActualizado?.fechaActivacion).not.toBeNull();
        expect(usoActualizado?.recompensaOtorgada).toBe(false);
        expect(usoActualizado?.requiereRevisionAdmin).toBe(true);
    });

    it("marca revisión de admin y notifica al llegar al 4º uso activado del año (FR-008/US-006)", async () => {
        const repo = new PagosRepository();
        const referidor = await crearSuscripcionPadre(`ref-cuarto-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-K2L3M4N5",
        });
        const anio = anioBogota();
        // 3 usos ya activados (con recompensa) del año en curso.
        for (let i = 0; i < 3; i++) {
            const otra = await crearSuscripcionPadre(`ref-cuarto-otra-${i}-${Date.now()}@test.co`);
            await repo.crearCodigoReferidoUso({
                codigoReferidoUsuarioId: referidor.suscripcion.id,
                suscripcionReferidaId: otra.suscripcion.id,
                anio,
                fechaActivacion: new Date(),
                recompensaOtorgada: true,
                recompensaOtorgadaEn: new Date(),
            });
        }
        const referido = await crearSuscripcionPadre(`refdo-cuarto-${Date.now()}@test.co`);
        const uso = await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.suscripcion.id,
            suscripcionReferidaId: referido.suscripcion.id,
            anio,
        });
        const pago = await crearPagoPendiente(referido.suscripcion.id);

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, referidor.admin.id);

        expect(resumen?.recompensaOtorgada).toBe(true);
        expect(resumen?.notificadoTopeAnual).toBe(true);
        const usoActualizado = await prisma.codigoReferidoUso.findUnique({ where: { id: uso.id } });
        expect(usoActualizado?.requiereRevisionAdmin).toBe(true);
    });

    it("no otorga recompensa si el referidor ya no está activo ni en gracia", async () => {
        const repo = new PagosRepository();
        const referidor = await crearSuscripcionPadre(`ref-susp-${Date.now()}@test.co`, {
            estado: EstadoSuscripcion.SUSPENDIDA,
            codigoReferidoPropio: "PI-PADRE-L3M4N5P6",
        });
        const referido = await crearSuscripcionPadre(`refdo-susp-${Date.now()}@test.co`);
        const uso = await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.suscripcion.id,
            suscripcionReferidaId: referido.suscripcion.id,
            anio: anioBogota(),
        });
        const pago = await crearPagoPendiente(referido.suscripcion.id);

        const resumen = await procesarRecompensasPagoAutorizado(pago.id, referidor.admin.id);

        expect(resumen?.recompensaOtorgada).toBe(false);
        const usoActualizado = await prisma.codigoReferidoUso.findUnique({ where: { id: uso.id } });
        expect(usoActualizado?.requiereRevisionAdmin).toBe(true);
        expect(usoActualizado?.recompensaOtorgada).toBe(false);
    });
});
