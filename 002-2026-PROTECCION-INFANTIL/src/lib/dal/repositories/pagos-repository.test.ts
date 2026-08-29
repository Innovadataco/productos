/**
 * SPEC-210 (002-PI-110): tests del PagosRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    MetodoPago,
    TipoBono,
    FuenteTasa,
    OrigenSuscripcion,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "./pagos-repository";

function nuevoEmail() {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
}

async function crearAdmin() {
    return prisma.usuario.create({
        data: {
            email: nuevoEmail(),
            passwordHash: "hash",
            rol: RolUsuario.ADMIN,
            estado: "activo",
        },
    });
}

async function crearPlan(adminId: string) {
    return new PagosRepository().crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_1,
        anio: 2026,
        nombre: "Plan test",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

async function crearUsuarioPadre() {
    return prisma.usuario.create({
        data: {
            email: nuevoEmail(),
            passwordHash: "hash",
            rol: RolUsuario.PARENT,
            estado: "activo",
        },
    });
}

describe("PagosRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea y lee un Plan por id y por clave única", async () => {
        const admin = await crearAdmin();
        const repo = new PagosRepository();

        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_12,
            anio: 2026,
            nombre: "Plan padre anual",
            precioBaseUSD: 99,
            precio: 0,
            creadoPorAdminId: admin.id,
        });

        const porId = await repo.obtenerPlanPorId(plan.id);
        expect(porId?.id).toBe(plan.id);

        const porClave = await repo.obtenerPlanPorClave(TipoTitular.PADRE, DuracionPlan.MES_12, 2026);
        expect(porClave?.id).toBe(plan.id);

        const lista = await repo.listarPlanes({ anio: 2026 });
        expect(lista).toHaveLength(1);
    });

    it("actualiza un Plan", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const actualizado = await repo.actualizarPlan(plan.id, { precioBaseUSD: 20 });
        expect(actualizado.precioBaseUSD).toBe(20);
    });

    it("crea y lee una Suscripción y sus pagos", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const encontrada = await repo.obtenerSuscripcionPorId(suscripcion.id);
        expect(encontrada?.estado).toBe(EstadoSuscripcion.ACTIVA);
        expect((await repo.listarSuscripcionesPorUsuario(padre.id)).map((s) => s.id)).toContain(suscripcion.id);

        const pago = await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: "abc123",
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
        });

        expect((await repo.obtenerPagoPorId(pago.id))?.suscripcionId).toBe(suscripcion.id);
        expect(await repo.listarPagosPorSuscripcion(suscripcion.id)).toHaveLength(1);

        const autorizado = await repo.actualizarPago(pago.id, { estado: EstadoPago.AUTORIZADO });
        expect(autorizado.estado).toBe(EstadoPago.AUTORIZADO);
    });

    it("crea y lista bonos promocionales y bonos aplicados", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const bono = await repo.crearBonoPromocional({
            nombre: "BONO-TEST",
            tipo: TipoBono.DESCUENTO_PCT,
            valor: 15,
            vigenciaInicio: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            vigenciaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            creadoPorAdminId: admin.id,
        });

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-002",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const aplicado = await repo.crearBonoAplicado({
            bonoId: bono.id,
            suscripcionId: suscripcion.id,
            descuentoUSD: 1.5,
        });

        expect((await repo.obtenerBonoPromocionalPorId(bono.id))?.nombre).toBe("BONO-TEST");
        expect(await repo.listarBonosActivos()).toHaveLength(1);
        expect(await repo.listarBonosAplicados(suscripcion.id)).toHaveLength(1);
        expect(aplicado.descuentoUSD).toBe(1.5);
    });

    it("crea y cuenta códigos de referido", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const referidor = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-REFE",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const referida = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-REFERIDA",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        await repo.crearCodigoReferidoUso({
            codigoReferidoUsuarioId: referidor.id,
            suscripcionReferidaId: referida.id,
            anio: 2026,
            recompensaOtorgada: true,
        });

        const count = await repo.contarReferidosExitososPorAnio(referidor.id, 2026);
        expect(count).toBe(1);
    });

    it("crea y lee tasas de cambio", async () => {
        const repo = new PagosRepository();
        const tasa = await repo.crearTasaCambio({
            monedaOrigen: "USD",
            monedaDestino: "COP",
            tasa: 4050,
            fecha: new Date(),
            fuente: FuenteTasa.API,
        });

        const masReciente = await repo.obtenerTasaCambioMasReciente("COP");
        expect(masReciente?.id).toBe(tasa.id);
        expect(masReciente?.tasa).toBe(4050);
    });

    it("lista planes paginados con filtros", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const { items, total } = await repo.listarPlanesPaginados({ anio: 2026 }, { skip: 0, take: 10 });
        expect(total).toBeGreaterThanOrEqual(1);
        expect(items.map((p) => p.id)).toContain(plan.id);
    });

    it("lista pagos pendientes y aplica búsqueda", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-PEND-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: "abc123",
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
        });

        const { items, total } = await repo.listarPagosPendientes({}, { skip: 0, take: 10 });
        expect(total).toBe(1);
        expect(items[0]?.suscripcion.usuario?.id).toBe(padre.id);

        const porEmail = await repo.listarPagosPendientes({ q: padre.email }, { skip: 0, take: 10 });
        expect(porEmail.total).toBe(1);
    });

    it("lista vencimientos próximos", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-VENC-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const { items, total } = await repo.listarVencimientosProximos({ dias: 7 }, { skip: 0, take: 10 });
        expect(total).toBeGreaterThanOrEqual(1);
        expect(items.map((s) => s.id)).toContain(suscripcion.id);
    });

    it("lista suscripciones en mora", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suspendida = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.SUSPENDIDA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-MORA-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const { items, total } = await repo.listarMora({}, { skip: 0, take: 10 });
        expect(total).toBeGreaterThanOrEqual(1);
        expect(items.map((s) => s.id)).toContain(suspendida.id);
    });

    it("lista bonos paginados", async () => {
        const admin = await crearAdmin();
        const repo = new PagosRepository();

        await repo.crearBonoPromocional({
            nombre: "BONO-LISTA",
            tipo: TipoBono.DESCUENTO_PCT,
            valor: 10,
            vigenciaInicio: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            vigenciaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            creadoPorAdminId: admin.id,
        });

        const { items, total } = await repo.listarBonos({}, { skip: 0, take: 10 });
        expect(total).toBeGreaterThanOrEqual(1);
        expect(items[0]?.nombre).toBe("BONO-LISTA");
    });

    it("registra un reembolso", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-REM-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        const pago = await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: "abc123",
            fechaReporte: new Date(),
            estado: EstadoPago.AUTORIZADO,
        });

        const reembolsado = await repo.registrarReembolso(pago.id, {
            montoReembolsoUSD: 10,
            motivoReembolso: "Solicitud del cliente",
            referenciaReembolso: "REF-123",
        });

        expect(reembolsado.estado).toBe(EstadoPago.REEMBOLSADO);
        expect(reembolsado.montoReembolsoUSD).toBe(10);
    });

    it("lista tasas vigentes con flag de desactualización", async () => {
        const repo = new PagosRepository();
        await repo.crearTasaCambio({
            monedaOrigen: "USD",
            monedaDestino: "COP",
            tasa: 4100,
            fecha: new Date(),
            fuente: FuenteTasa.API,
        });

        const tasas = await repo.listarTasasVigentes({});
        const cop = tasas.find((t) => t.monedaDestino === "COP");
        expect(cop).toBeDefined();
        expect(cop?.desactualizada).toBe(false);
        expect(cop?.horasDesdeActualizacion).toBe(0);
    });

    it("detecta suscripción vigente para titular (usuario y colegio)", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const { colegio } = await crearColegioConAdmin();
        const planPadre = await crearPlan(admin.id);
        const repo = new PagosRepository();

        expect(await repo.existeSuscripcionVigenteParaTitular({ usuarioId: padre.id })).toBe(false);

        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: planPadre.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-VIG-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        expect(await repo.existeSuscripcionVigenteParaTitular({ usuarioId: padre.id })).toBe(true);

        const planColegio = await repo.crearPlan({
            tipoTitular: TipoTitular.COLEGIO,
            duracion: DuracionPlan.MES_12,
            anio: 2026,
            nombre: "Plan colegio",
            precioBaseUSD: 100,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.COLEGIO,
            colegioId: colegio.id,
            estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
            planActualId: planColegio.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-VIG-002",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        expect(await repo.existeSuscripcionVigenteParaTitular({ colegioId: colegio.id })).toBe(true);
    });

    it("cuenta suscripciones freemium por usuario", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        expect(await repo.contarSuscripcionesFreemiumPorUsuario(padre.id)).toBe(0);

        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            origen: OrigenSuscripcion.FREEMIUM_AUTO,
            esFreemium: true,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-FREE-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        expect(await repo.contarSuscripcionesFreemiumPorUsuario(padre.id)).toBe(1);
    });

    it("obtiene ficha de cliente", async () => {
        const admin = await crearAdmin();
        const padre = await crearUsuarioPadre();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();

        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-FICHA-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        await repo.crearPago({
            suscripcionId: suscripcion.id,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: 10,
            montoNetoUSD: 10,
            tasaCambioAplicada: 4000,
            montoLocalPagado: 40000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: "abc123",
            fechaReporte: new Date(),
            estado: EstadoPago.PENDIENTE_AUTORIZACION,
        });

        const ficha = await repo.obtenerFichaCliente(suscripcion.id);
        expect(ficha.suscripcion?.id).toBe(suscripcion.id);
        expect(ficha.pagos).toHaveLength(1);
    });
});
