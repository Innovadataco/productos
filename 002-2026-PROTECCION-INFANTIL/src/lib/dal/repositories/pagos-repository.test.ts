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
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
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
});
