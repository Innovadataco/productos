/**
 * SPEC-216 (002-PI-116): tests de integración de POST /api/pagos/aplicar-bono.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    TipoBono,
} from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function crearRequest(body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request("http://localhost:5005/api/pagos/aplicar-bono", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function seedBonoYSubPadre(overrides: Partial<{ tipo: TipoBono; valor: number; vigenciaFin: Date; usosMaximosTotales: number | null; aplicaSoloA: TipoTitular | null }> = {}) {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-bono-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-bono-${Date.now()}@test.co`);
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio: 2026,
        nombre: "Plan padre mensual",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-BONO-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    const ahora = new Date();
    const bono = await repo.crearBonoPromocional({
        nombre: `BONO-INT-${Date.now()}`,
        tipo: overrides.tipo ?? TipoBono.DESCUENTO_PCT,
        valor: overrides.valor ?? 20,
        vigenciaInicio: new Date(ahora.getTime() - 24 * 60 * 60 * 1000),
        vigenciaFin: overrides.vigenciaFin ?? new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
        usosMaximosTotales: overrides.usosMaximosTotales ?? null,
        usosMaximosPorCliente: 1,
        aplicaANuevos: true,
        aplicaARenovaciones: false,
        aplicaSoloA: overrides.aplicaSoloA ?? null,
        creadoPorAdminId: admin.id,
    });
    return { admin, padre, plan, suscripcion, bono };
}

async function seedBonoYSubColegio() {
    const repo = new PagosRepository();
    const { colegio, admin: schoolAdmin } = await crearColegioConAdmin();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-colegio-bono-${Date.now()}@test.co`);
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_12,
        anio: 2026,
        nombre: "Plan colegio anual",
        precioBaseUSD: 100,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.COLEGIO,
        colegioId: colegio.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-COLEGIO-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    const ahora = new Date();
    const bono = await repo.crearBonoPromocional({
        nombre: `BONO-COLEGIO-${Date.now()}`,
        tipo: TipoBono.DESCUENTO_PCT,
        valor: 15,
        vigenciaInicio: new Date(ahora.getTime() - 24 * 60 * 60 * 1000),
        vigenciaFin: new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
        creadoPorAdminId: admin.id,
    });
    return { colegio, schoolAdmin, admin, plan, suscripcion, bono };
}

describe("POST /api/pagos/aplicar-bono", () => {
    // SPEC-283 (002-PI-180): reset POR PRUEBA porque el modelo Plan tiene
    // @@unique([tipoTitular, duracion, anio]) y cada test crea un Plan con
    // (PADRE, MES_1, 2026) → colisión unique determinista al migrar a beforeAll.
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("aplica un bono válido para un padre", async () => {
        const { padre, suscripcion, bono } = await seedBonoYSubPadre();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.descuentoUSD).toBe(2);
        expect(json.bonoAplicadoId).toBeDefined();
    });

    it("aplica un bono válido para un colegio", async () => {
        const { schoolAdmin, suscripcion, bono } = await seedBonoYSubColegio();
        mockToken = await crearTokenUsuario(schoolAdmin.id, RolUsuario.SCHOOL_ADMIN);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 100 }, mockToken));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.descuentoUSD).toBe(15);
    });

    it("rechaza si el bono está vencido", async () => {
        const { padre, suscripcion, bono } = await seedBonoYSubPadre({
            vigenciaFin: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("vigente");
    });

    it("rechaza si se supera el tope global", async () => {
        const { padre, suscripcion: sub1, bono } = await seedBonoYSubPadre({ usosMaximosTotales: 1 });
        const padre2 = await crearUsuario(RolUsuario.PARENT, `padre2-bono-${Date.now()}@test.co`);
        const repo = new PagosRepository();
        const plan = await repo.obtenerPlanPorId(sub1.planActualId);
        if (!plan) throw new Error("Plan no encontrado");
        const sub2 = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre2.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `REF-BONO2-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);
        const res1 = await POST(crearRequest({ suscripcionId: sub1.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res1.status).toBe(201);

        mockToken = await crearTokenUsuario(padre2.id, RolUsuario.PARENT);
        const res2 = await POST(crearRequest({ suscripcionId: sub2.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res2.status).toBe(409);
        const json = await res2.json();
        expect(json.error.message).toContain("tope");
    });

    it("rechaza si se supera el tope por cliente (idempotencia: mismo bono + suscripción)", async () => {
        const { padre, suscripcion, bono } = await seedBonoYSubPadre();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res1 = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res1.status).toBe(201);

        const res2 = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res2.status).toBe(409);
        const json = await res2.json();
        expect(json.error.message).toContain("ya fue aplicado");
    });

    it("rechaza idempotencia: mismo bono + suscripción", async () => {
        const { padre, suscripcion, bono } = await seedBonoYSubPadre();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res1 = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res1.status).toBe(201);

        const res2 = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));
        expect(res2.status).toBe(409);
    });

    it("rechaza si la suscripción no pertenece al padre autenticado", async () => {
        const { suscripcion, bono } = await seedBonoYSubPadre();
        const otroPadre = await crearUsuario(RolUsuario.PARENT, `otro-padre-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(otroPadre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 10 }, mockToken));

        expect(res.status).toBe(404);
    });

    it("rechaza si la suscripción no pertenece al colegio del admin", async () => {
        const { suscripcion, bono } = await seedBonoYSubColegio();
        const { admin: otroAdmin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(otroAdmin.id, RolUsuario.SCHOOL_ADMIN);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, bonoId: bono.id, montoBaseUSD: 100 }, mockToken));

        expect(res.status).toBe(404);
    });

    it("rechaza roles distintos a SCHOOL_ADMIN o PARENT", async () => {
        const operador = await crearUsuario(RolUsuario.OPERADOR, `operador-bono-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(operador.id, RolUsuario.OPERADOR);

        const res = await POST(crearRequest({ suscripcionId: "sub-1", bonoId: "bono-1", montoBaseUSD: 10 }, mockToken));

        expect(res.status).toBe(403);
    });

    it("rechaza body inválido", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-val-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: "sub-1", bonoId: "bono-1" }, mockToken));

        expect(res.status).toBe(400);
    });
});
