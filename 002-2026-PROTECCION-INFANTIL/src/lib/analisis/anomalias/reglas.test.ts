/**
 * SPEC-225 (FR-016): tests de integración de las 6 reglas del detector.
 * Cada regla se ejercita con dataset A FAVOR y EN CONTRA, más los casos de
 * severidad por umbral y base mínima insuficiente (SC-005). La deduplicación
 * se cubre en detector.test.ts y en anomalia-repository.test.ts.
 *
 * Miércoles 2026-08-26 10:00 Bogotá = 15:00 UTC; semana actual Bogotá:
 * 2026-08-24 → 2026-08-30; semana anterior: 2026-08-17 → 2026-08-23.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { PARAMETROS_ANOMALIAS_DEFAULT } from "./parametros";
import { semanaCalendarioBogota, semanaAnterior, ultimas24h } from "./ventanas";
import { detectarMoraAnomala } from "./reglas/mora-anomala";
import { detectarCrecimientoAnomaloCiudad } from "./reglas/crecimiento-anomalo-ciudad";
import { detectarUsoCaidoAbrupto } from "./reglas/uso-caido-abrupto";
import { detectarCancelacionColegioGrande } from "./reglas/cancelacion-colegio-grande";
import { detectarCaidaRecaudoCiudad } from "./reglas/caida-recaudo-ciudad";
import { detectarCancelacionesMasivas24h } from "./reglas/cancelaciones-masivas-24h";
import type { ContextoDeteccion, ParametrosAnomalias } from "./tipos";
import {
    crearAdmin,
    crearPlan,
    crearSuscripcion,
    crearPago,
    crearColegioConAdmin,
    crearPlataforma,
    crearReporteMinimo,
    crearSesion,
} from "./fixtures";

const AHORA = new Date("2026-08-26T15:00:00Z");
const DIA_MS = 24 * 60 * 60 * 1000;

function crearCtx(parametros: ParametrosAnomalias = PARAMETROS_ANOMALIAS_DEFAULT): ContextoDeteccion {
    const semanaActual = semanaCalendarioBogota(AHORA);
    return {
        ahora: AHORA,
        parametros,
        ventanas: {
            semanaActual,
            semanaAnterior: semanaAnterior(semanaActual),
            ultimas24h: ultimas24h(AHORA),
        },
        repo: new AnomaliaRepository(),
    };
}

/** Suscripción "históricamente puntual": alta 2026-06-01 + 2 pagos MES_1 a tiempo. */
async function suscripcionPuntual(planId: string, fechaFin: Date) {
    const suscripcion = await crearSuscripcion(planId, {
        fechaInicio: new Date("2026-06-01T00:00:00Z"),
        fechaFin,
    });
    await crearPago(suscripcion.id, { fechaReporte: new Date("2026-06-01T00:00:00Z") });
    await crearPago(suscripcion.id, { fechaReporte: new Date("2026-07-01T00:00:00Z") });
    return suscripcion;
}

describe("regla PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: mora de 16 días con 2 pagos puntuales → candidato MEDIA", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const suscripcion = await suscripcionPuntual(
            plan.id,
            new Date(AHORA.getTime() - 16 * DIA_MS)
        );

        const candidatos = await detectarMoraAnomala(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL",
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            severidad: "MEDIA",
        });
        expect(candidatos[0]!.datosContexto).toMatchObject({ diasMora: 16, pagosPuntuales: 2 });
    });

    it("mora de 31 días → severidad ALTA (umbral alto)", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        await suscripcionPuntual(plan.id, new Date(AHORA.getTime() - 31 * DIA_MS));

        const candidatos = await detectarMoraAnomala(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]!.severidad).toBe("ALTA");
    });

    it("en contra: cliente NO históricamente puntual (1 solo pago) → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const suscripcion = await crearSuscripcion(plan.id, {
            fechaInicio: new Date("2026-06-01T00:00:00Z"),
            fechaFin: new Date(AHORA.getTime() - 16 * DIA_MS),
        });
        await crearPago(suscripcion.id, { fechaReporte: new Date("2026-06-01T00:00:00Z") });

        expect(await detectarMoraAnomala(crearCtx())).toHaveLength(0);
    });

    it("en contra: renovación autorizada posterior a fechaFin → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const fechaFin = new Date(AHORA.getTime() - 16 * DIA_MS);
        const suscripcion = await suscripcionPuntual(plan.id, fechaFin);
        await crearPago(suscripcion.id, {
            fechaReporte: new Date(fechaFin.getTime() + DIA_MS),
            fechaAutorizacion: new Date(fechaFin.getTime() + DIA_MS),
        });

        expect(await detectarMoraAnomala(crearCtx())).toHaveLength(0);
    });

    it("en contra: mora por debajo del umbral medio → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        await suscripcionPuntual(plan.id, new Date(AHORA.getTime() - 10 * DIA_MS));

        expect(await detectarMoraAnomala(crearCtx())).toHaveLength(0);
    });
});

describe("regla CRECIMIENTO_ANOMALO_CIUDAD", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: altas 3 → 4 (+33%) en la misma ciudad → candidato BAJA", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const { colegio, ciudad } = await crearColegioConAdmin();
        for (let i = 0; i < 3; i++) {
            await crearSuscripcion(plan.id, {
                colegioId: colegio.id,
                createdAt: new Date("2026-08-18T12:00:00Z"),
            });
        }
        for (let i = 0; i < 4; i++) {
            await crearSuscripcion(plan.id, {
                colegioId: colegio.id,
                createdAt: new Date("2026-08-25T12:00:00Z"),
            });
        }

        const candidatos = await detectarCrecimientoAnomaloCiudad(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "CRECIMIENTO_ANOMALO_CIUDAD",
            sujetoTipo: "Ciudad",
            sujetoId: ciudad.id,
            severidad: "BAJA",
        });
    });

    it("en contra: semana de referencia bajo la base mínima → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const { colegio } = await crearColegioConAdmin();
        for (let i = 0; i < 2; i++) {
            await crearSuscripcion(plan.id, {
                colegioId: colegio.id,
                createdAt: new Date("2026-08-18T12:00:00Z"),
            });
        }
        for (let i = 0; i < 6; i++) {
            await crearSuscripcion(plan.id, {
                colegioId: colegio.id,
                createdAt: new Date("2026-08-25T12:00:00Z"),
            });
        }

        expect(await detectarCrecimientoAnomaloCiudad(crearCtx())).toHaveLength(0);
    });
});

describe("regla USO_CAIDO_ABRUPTO", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: sesiones 10 → 4 (-60%) → candidato MEDIA", async () => {
        const { colegio, admin, tenant } = await crearColegioConAdmin();
        for (let i = 0; i < 10; i++) {
            await crearSesion(admin.id, tenant.id, new Date("2026-08-18T12:00:00Z"));
        }
        for (let i = 0; i < 4; i++) {
            await crearSesion(admin.id, tenant.id, new Date("2026-08-25T12:00:00Z"));
        }

        const candidatos = await detectarUsoCaidoAbrupto(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "USO_CAIDO_ABRUPTO",
            sujetoTipo: "Colegio",
            sujetoId: colegio.id,
            severidad: "MEDIA",
        });
    });

    it("en contra: caída del 40% (bajo el umbral) → sin candidato", async () => {
        const { admin, tenant } = await crearColegioConAdmin();
        for (let i = 0; i < 10; i++) {
            await crearSesion(admin.id, tenant.id, new Date("2026-08-18T12:00:00Z"));
        }
        for (let i = 0; i < 6; i++) {
            await crearSesion(admin.id, tenant.id, new Date("2026-08-25T12:00:00Z"));
        }

        expect(await detectarUsoCaidoAbrupto(crearCtx())).toHaveLength(0);
    });
});

describe("regla CANCELACION_COLEGIO_GRANDE", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: colegio con más reportes que el umbral cancela en 24h → ALTA", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const plataforma = await crearPlataforma();
        const { colegio, tenant, ciudad, pais } = await crearColegioConAdmin();
        for (let i = 0; i < 3; i++) {
            await crearReporteMinimo(plataforma.id, tenant.id, {
                ciudadId: ciudad.id,
                paisId: pais.id,
            });
        }
        await crearSuscripcion(plan.id, {
            colegioId: colegio.id,
            estado: "CANCELADA",
            canceladaEn: new Date(AHORA.getTime() - 60 * 60 * 1000),
        });

        const ctx = crearCtx({ ...PARAMETROS_ANOMALIAS_DEFAULT, colegioGrandeMinReportes: 2 });
        const candidatos = await detectarCancelacionColegioGrande(ctx);
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "CANCELACION_COLEGIO_GRANDE",
            sujetoTipo: "Colegio",
            sujetoId: colegio.id,
            severidad: "ALTA",
        });
    });

    it("en contra: colegio con reportes en el umbral (no supera) → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const plataforma = await crearPlataforma();
        const { colegio, tenant } = await crearColegioConAdmin();
        for (let i = 0; i < 2; i++) {
            await crearReporteMinimo(plataforma.id, tenant.id);
        }
        await crearSuscripcion(plan.id, {
            colegioId: colegio.id,
            estado: "CANCELADA",
            canceladaEn: new Date(AHORA.getTime() - 60 * 60 * 1000),
        });

        const ctx = crearCtx({ ...PARAMETROS_ANOMALIAS_DEFAULT, colegioGrandeMinReportes: 2 });
        expect(await detectarCancelacionColegioGrande(ctx)).toHaveLength(0);
    });
});

describe("regla CAIDA_RECAUDO_CIUDAD", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: recaudo 1000 → 500 USD (-50%) → candidato ALTA", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const { colegio, ciudad } = await crearColegioConAdmin();
        const suscripcion = await crearSuscripcion(plan.id, { colegioId: colegio.id });
        for (let i = 0; i < 2; i++) {
            await crearPago(suscripcion.id, {
                fechaReporte: new Date("2026-08-18T12:00:00Z"),
                fechaAutorizacion: new Date("2026-08-18T12:00:00Z"),
                montoNetoUSD: 500,
            });
        }
        await crearPago(suscripcion.id, {
            fechaReporte: new Date("2026-08-25T12:00:00Z"),
            fechaAutorizacion: new Date("2026-08-25T12:00:00Z"),
            montoNetoUSD: 500,
        });

        const candidatos = await detectarCaidaRecaudoCiudad(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "CAIDA_RECAUDO_CIUDAD",
            sujetoTipo: "Ciudad",
            sujetoId: ciudad.id,
            severidad: "ALTA",
        });
        expect(candidatos[0]!.datosContexto).toMatchObject({
            recaudoSemanaActualUSD: 500,
            recaudoSemanaAnteriorUSD: 1000,
        });
    });

    it("en contra: caída del 20% (bajo el umbral) → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const { colegio } = await crearColegioConAdmin();
        const suscripcion = await crearSuscripcion(plan.id, { colegioId: colegio.id });
        await crearPago(suscripcion.id, {
            fechaReporte: new Date("2026-08-18T12:00:00Z"),
            fechaAutorizacion: new Date("2026-08-18T12:00:00Z"),
            montoNetoUSD: 1000,
        });
        await crearPago(suscripcion.id, {
            fechaReporte: new Date("2026-08-25T12:00:00Z"),
            fechaAutorizacion: new Date("2026-08-25T12:00:00Z"),
            montoNetoUSD: 800,
        });

        expect(await detectarCaidaRecaudoCiudad(crearCtx())).toHaveLength(0);
    });
});

describe("regla CANCELACIONES_MASIVAS_24H", () => {
    beforeEach(() => resetDatabase());
    afterEach(() => resetDatabase());

    it("a favor: 6 cancelaciones en 24h (umbral 5) → 1 candidato ALTA global", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        for (let i = 0; i < 6; i++) {
            await crearSuscripcion(plan.id, {
                estado: "CANCELADA",
                canceladaEn: new Date(AHORA.getTime() - (i + 1) * 60 * 60 * 1000),
            });
        }

        const candidatos = await detectarCancelacionesMasivas24h(crearCtx());
        expect(candidatos).toHaveLength(1);
        expect(candidatos[0]).toMatchObject({
            tipo: "CANCELACIONES_MASIVAS_24H",
            sujetoTipo: null,
            sujetoId: null,
            severidad: "ALTA",
        });
    });

    it("en contra: exactamente el umbral (no supera) → sin candidato", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        for (let i = 0; i < 5; i++) {
            await crearSuscripcion(plan.id, {
                estado: "CANCELADA",
                canceladaEn: new Date(AHORA.getTime() - (i + 1) * 60 * 60 * 1000),
            });
        }

        expect(await detectarCancelacionesMasivas24h(crearCtx())).toHaveLength(0);
    });

    it("en contra: cancelaciones de hace más de 24h no cuentan", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        for (let i = 0; i < 8; i++) {
            await crearSuscripcion(plan.id, {
                estado: "CANCELADA",
                canceladaEn: new Date(AHORA.getTime() - 2 * DIA_MS),
            });
        }

        expect(await detectarCancelacionesMasivas24h(crearCtx())).toHaveLength(0);
    });
});
