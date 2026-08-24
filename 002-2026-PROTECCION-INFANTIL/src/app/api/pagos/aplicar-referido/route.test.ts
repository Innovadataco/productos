/**
 * SPEC-215 (002-PI-115): tests de integración de POST /api/pagos/aplicar-referido.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { generarCodigoReferidoUnico } from "@/lib/pagos/referido.service";
import { anioBogota } from "@/lib/pagos/renovacion-calculos";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    TipoParametro,
    CategoriaParametro,
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
    return new Request("http://localhost:5005/api/pagos/aplicar-referido", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function crearSuscripcionPadre(
    email: string,
    overrides: { estado?: EstadoSuscripcion; codigoReferidoPropio?: string } = {}
) {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-ref-${Date.now()}-${Math.random()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, email);
    // El plan es único por (tipoTitular, duracion, anio): se reutiliza dentro del mismo test.
    const planExistente = await repo.obtenerPlanPorClave(TipoTitular.PADRE, DuracionPlan.MES_1, 2026);
    const plan =
        planExistente ??
        (await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: 2026,
            nombre: "Plan padre mensual referidos",
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        }));
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: overrides.estado ?? EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        // FR-001: por defecto el código se auto-genera (mismo generador que usa
        // crearSuscripcionCliente); el override solo cuando el test fija uno.
        codigoReferidoPropio: overrides.codigoReferidoPropio ?? (await generarCodigoReferidoUnico(TipoTitular.PADRE)),
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    return { admin, padre, plan, suscripcion };
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

describe("POST /api/pagos/aplicar-referido", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("aplica un código válido y registra el uso con el año Bogotá", async () => {
        await seedParametroDescuento("15");
        const referidor = await crearSuscripcionPadre(`referidor-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-A7F3D2E9",
        });
        const referido = await crearSuscripcionPadre(`referido-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(referido.padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-A7F3D2E9" }, mockToken)
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.estado).toBe("REGISTRADO");
        expect(json.codigoReferido).toBe("PI-PADRE-A7F3D2E9");
        expect(json.referidorId).toBe(referidor.suscripcion.id);
        expect(json.descuentoPrimerPagoPct).toBe(15);

        const uso = await prisma.codigoReferidoUso.findUnique({ where: { id: json.usoId } });
        expect(uso).not.toBeNull();
        expect(uso?.anio).toBe(anioBogota());
        expect(uso?.fechaActivacion).toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REFERIDO_REGISTRADO", recursoId: json.usoId },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(referido.padre.id);
    });

    it("la suscripción nueva genera automáticamente su código propio (FR-001)", async () => {
        const { suscripcion } = await crearSuscripcionPadre(`auto-${Date.now()}@test.co`);
        expect(suscripcion.codigoReferidoPropio).toMatch(/^PI-PADRE-[A-HJ-NP-Z2-9]{8}$/);
    });

    it("rechaza autorreferido (propio código)", async () => {
        const { padre, suscripcion } = await crearSuscripcionPadre(`self-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-B8G4E3F2",
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: suscripcion.id, codigoReferido: "PI-PADRE-B8G4E3F2" }, mockToken)
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("referido_autorreferido");
    });

    it("rechaza código inexistente", async () => {
        const referido = await crearSuscripcionPadre(`nocode-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(referido.padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-Z9Y8X7W6" }, mockToken)
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("referido_invalido");
    });

    it("rechaza código de una suscripción inactiva", async () => {
        await crearSuscripcionPadre(`susp-${Date.now()}@test.co`, {
            estado: EstadoSuscripcion.SUSPENDIDA,
            codigoReferidoPropio: "PI-PADRE-C7D6E5F4",
        });
        const referido = await crearSuscripcionPadre(`activo-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(referido.padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-C7D6E5F4" }, mockToken)
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("referido_invalido");
    });

    it("rechaza duplicado (mismo referidor y referido)", async () => {
        await crearSuscripcionPadre(`dup-ref-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-D4E5F6G7",
        });
        const referido = await crearSuscripcionPadre(`dup-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(referido.padre.id, RolUsuario.PARENT);

        const body = { suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-D4E5F6G7" };
        const res1 = await POST(crearRequest(body, mockToken));
        expect(res1.status).toBe(200);

        const res2 = await POST(crearRequest(body, mockToken));
        expect(res2.status).toBe(409);
        const json = await res2.json();
        expect(json.error.code).toBe("referido_ya_registrado");
    });

    // Sembrar el tope anual (5 exitosos + fixtures) supera los 5s en CI (5.7s observado).
    it("rechaza cuando el referidor llegó al tope anual de exitosos", { timeout: 30_000 }, async () => {
        const repo = new PagosRepository();
        const referidor = await crearSuscripcionPadre(`tope-ref-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-E5F6G7H8",
        });
        const anio = anioBogota();
        for (let i = 0; i < 5; i++) {
            const otra = await crearSuscripcionPadre(`tope-otra-${i}-${Date.now()}@test.co`);
            await repo.crearCodigoReferidoUso({
                codigoReferidoUsuarioId: referidor.suscripcion.id,
                suscripcionReferidaId: otra.suscripcion.id,
                anio,
                recompensaOtorgada: true,
                recompensaOtorgadaEn: new Date(),
            });
        }

        const referido = await crearSuscripcionPadre(`tope-nuevo-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(referido.padre.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-E5F6G7H8" }, mockToken)
        );

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe("referido_tope_anual");
    });

    it("rechaza si la suscripción no pertenece al usuario autenticado", async () => {
        await crearSuscripcionPadre(`ajena-ref-${Date.now()}@test.co`, {
            codigoReferidoPropio: "PI-PADRE-F6G7H8J9",
        });
        const referido = await crearSuscripcionPadre(`ajena-${Date.now()}@test.co`);
        const otro = await crearUsuario(RolUsuario.PARENT, `otro-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(otro.id, RolUsuario.PARENT);

        const res = await POST(
            crearRequest({ suscripcionId: referido.suscripcion.id, codigoReferido: "PI-PADRE-F6G7H8J9" }, mockToken)
        );

        expect(res.status).toBe(404);
    });

    it("rechaza roles distintos a SCHOOL_ADMIN o PARENT", async () => {
        const operador = await crearUsuario(RolUsuario.OPERADOR, `op-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(operador.id, RolUsuario.OPERADOR);

        const res = await POST(
            crearRequest({ suscripcionId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", codigoReferido: "PI-PADRE-A7F3D2E9" }, mockToken)
        );

        expect(res.status).toBe(403);
    });

    it("rechaza body inválido", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `val-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: "no-es-cuid" }, mockToken));

        expect(res.status).toBe(400);
    });
});
