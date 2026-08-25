/**
 * SPEC-244 (002-PI-147): tests de integración del cálculo de totales del checkout.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { prisma } from "@/lib/prisma";
import { calcularTotales } from "./calculo-totales.service";
import { RolUsuario, TipoTitular, DuracionPlan, TipoBono, FuenteTasa } from "@prisma/client";

async function crearParametrosIva(porcentaje: string, aplicaA: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.iva.porcentaje" },
        update: { valor: porcentaje },
        create: { clave: "pagos.iva.porcentaje", valor: porcentaje, tipo: "FLOAT", categoria: "SYSTEM", esPublico: false },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.iva.aplica_a" },
        update: { valor: aplicaA },
        create: { clave: "pagos.iva.aplica_a", valor: aplicaA, tipo: "STRING", categoria: "SYSTEM", esPublico: false },
    });
}

async function crearPlanYContexto() {
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-calc-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-calc-${Date.now()}@test.co`);
    const repo = new PagosRepository();
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_3,
        anio: new Date().getFullYear(),
        nombre: "Padre · 3 meses",
        precioBaseUSD: 10,
        precioBaseCOP: 100_000,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    return { admin, padre, plan, repo };
}

describe("calcularTotales", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("calcula desglose con IVA y sin bono", async () => {
        const { padre, plan } = await crearPlanYContexto();
        await crearParametrosIva("19", "todos");

        const desglose = await calcularTotales(plan, TipoTitular.PADRE, undefined, padre.id);

        expect(desglose.subtotal).toBe(100_000);
        expect(desglose.descuentoBono).toBe(0);
        expect(desglose.baseGravable).toBe(100_000);
        expect(desglose.iva).toBe(19_000);
        expect(desglose.total).toBe(119_000);
    });

    it("aplica descuento de bono y convierte USD→COP con tasa", async () => {
        const { padre, plan, repo } = await crearPlanYContexto();
        await crearParametrosIva("19", "todos");
        await repo.crearTasaCambio({
            monedaOrigen: "USD",
            monedaDestino: "COP",
            tasa: 4_000,
            fecha: new Date(),
            fuente: FuenteTasa.API,
        });
        await repo.crearBonoPromocional({
            nombre: "BONO20",
            tipo: TipoBono.DESCUENTO_PCT,
            valor: 20,
            vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
            vigenciaFin: new Date(Date.now() + 24 * 60 * 60 * 1000),
            creadoPorAdminId: (await prisma.usuario.findFirst({ where: { rol: "ADMIN" } }))!.id,
        });

        const desglose = await calcularTotales(plan, TipoTitular.PADRE, "BONO20", padre.id);

        // 10 USD * 20% = 2 USD descuento → 2 * 4000 = 8000 COP
        expect(desglose.descuentoBono).toBe(8_000);
        expect(desglose.baseGravable).toBe(92_000);
        expect(desglose.iva).toBe(17_480);
        expect(desglose.total).toBe(109_480);
    });

    it("excluye IVA para padres cuando aplica_a=solo_colegios", async () => {
        const { padre, plan } = await crearPlanYContexto();
        await crearParametrosIva("19", "solo_colegios");

        const desglose = await calcularTotales(plan, TipoTitular.PADRE, undefined, padre.id);

        expect(desglose.iva).toBe(0);
        expect(desglose.total).toBe(100_000);
    });

    it("falla con bono inexistente", async () => {
        const { padre, plan } = await crearPlanYContexto();
        await crearParametrosIva("19", "todos");

        await expect(calcularTotales(plan, TipoTitular.PADRE, "NOEXISTE", padre.id)).rejects.toThrow("Cupón no encontrado");
    });
});
