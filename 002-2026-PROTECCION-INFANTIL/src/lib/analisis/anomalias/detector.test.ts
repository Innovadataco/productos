/**
 * SPEC-225 (FR-016, SC-001..SC-004): tests de integración del orquestador
 * `ejecutarDeteccion` — detección multi-regla en un tick, deduplicación del
 * segundo tick (SC-002), alerta al CEO solo en severidad ALTA (SC-003),
 * kill-switch `email_inmediato_habilitado` (SC-004) y fail-open de
 * notificaciones (Acceptance US2-4).
 *
 * Usa el seed real `seedAnomalias()` (parámetros + regla/plantillas Motor
 * Notif), lo que a la vez valida su idempotencia parcial en runtime.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedAnomalias } from "../../../../prisma/seed";
import { ejecutarDeteccion } from "./detector";
import {
    crearAdmin,
    crearPlan,
    crearSuscripcion,
    crearPago,
    crearColegioConAdmin,
    crearPlataforma,
    crearReporteMinimo,
} from "./fixtures";

const AHORA = new Date("2026-08-26T15:00:00Z");
const DIA_MS = 24 * 60 * 60 * 1000;

/** Dataset: 1 mora MEDIA + 1 cancelación colegio grande ALTA + cancelaciones masivas ALTA. */
async function sembrarDataset() {
    const admin = await crearAdmin();
    const plan = await crearPlan(admin.id);
    const plataforma = await crearPlataforma();
    const { colegio, tenant } = await crearColegioConAdmin();

    // Mora MEDIA (16 días, 2 pagos puntuales).
    const mora = await crearSuscripcion(plan.id, {
        fechaInicio: new Date("2026-06-01T00:00:00Z"),
        fechaFin: new Date(AHORA.getTime() - 16 * DIA_MS),
    });
    await crearPago(mora.id, { fechaReporte: new Date("2026-06-01T00:00:00Z") });
    await crearPago(mora.id, { fechaReporte: new Date("2026-07-01T00:00:00Z") });

    // Colegio grande (umbral bajado a 2 vía parámetro) que cancela ahora.
    await prisma.parametroSistema.update({
        where: { clave: "analisis.anomalias.colegio_grande_min_reportes" },
        data: { valor: "2" },
    });
    for (let i = 0; i < 3; i++) {
        await crearReporteMinimo(plataforma.id, tenant.id);
    }
    await crearSuscripcion(plan.id, {
        colegioId: colegio.id,
        estado: "CANCELADA",
        canceladaEn: new Date(AHORA.getTime() - 30 * 60 * 1000),
    });

    // Ráfaga de cancelaciones (umbral bajado a 2; la del colegio ya cuenta 1).
    await prisma.parametroSistema.update({
        where: { clave: "analisis.anomalias.cancelaciones_24h_umbral" },
        data: { valor: "2" },
    });
    for (let i = 0; i < 2; i++) {
        await crearSuscripcion(plan.id, {
            estado: "CANCELADA",
            canceladaEn: new Date(AHORA.getTime() - (i + 2) * 60 * 60 * 1000),
        });
    }
    return { admin };
}

describe("ejecutarDeteccion · orquestación del tick", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedAnomalias();
    });

    it("un tick crea las anomalías de cada regla con tipo/severidad/sujeto correctos", async () => {
        await sembrarDataset();
        const resumen = await ejecutarDeteccion(AHORA);

        expect(resumen.errores).toEqual([]);
        expect(resumen.detectadas).toBe(3);
        expect(resumen.altas).toBe(2);

        const porTipo = new Map(
            (await prisma.anomalia.findMany()).map((a) => [a.tipo, a])
        );
        expect(porTipo.get("PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL")).toMatchObject({
            severidad: "MEDIA",
            sujetoTipo: "Suscripcion",
        });
        expect(porTipo.get("CANCELACION_COLEGIO_GRANDE")).toMatchObject({
            severidad: "ALTA",
            sujetoTipo: "Colegio",
        });
        expect(porTipo.get("CANCELACIONES_MASIVAS_24H")).toMatchObject({
            severidad: "ALTA",
            sujetoTipo: null,
            sujetoId: null,
        });
        // FR-008: datosContexto solo agregados (objeto JSON, sin textos).
        for (const anomalia of porTipo.values()) {
            expect(typeof anomalia.datosContexto).toBe("object");
        }
    });

    it("segundo tick sobre el mismo dataset crea 0 anomalías nuevas (SC-002)", async () => {
        await sembrarDataset();
        await ejecutarDeteccion(AHORA);
        const antes = await prisma.anomalia.count();

        const segundo = await ejecutarDeteccion(AHORA);
        expect(segundo.detectadas).toBe(0);
        expect(await prisma.anomalia.count()).toBe(antes);
    });

    it("ALTA programa EMAIL+IN_APP por admin activo; MEDIA no genera nada (SC-003)", async () => {
        const { admin } = await sembrarDataset();
        await ejecutarDeteccion(AHORA);

        const anomalias = await prisma.anomalia.findMany();
        const altas = anomalias.filter((a) => a.severidad === "ALTA");
        const medias = anomalias.filter((a) => a.severidad === "MEDIA");
        expect(altas).toHaveLength(2);
        expect(medias).toHaveLength(1);

        for (const alta of altas) {
            const filas = await prisma.notificacion.findMany({
                where: { evento: "analisis.anomalia.detectada", sujetoId: alta.id },
            });
            // 1 admin activo × 2 canales (EMAIL obligatoria + IN_APP).
            expect(filas).toHaveLength(2);
            expect(new Set(filas.map((f) => f.canal))).toEqual(new Set(["EMAIL", "IN_APP"]));
            expect(filas.every((f) => f.destinatarioUsuarioId === admin.id)).toBe(true);
        }
        for (const media of medias) {
            expect(
                await prisma.notificacion.count({
                    where: { evento: "analisis.anomalia.detectada", sujetoId: media.id },
                })
            ).toBe(0);
        }
    });

    it("kill-switch: email_inmediato_habilitado=false persiste sin programar (SC-004)", async () => {
        await prisma.parametroSistema.update({
            where: { clave: "analisis.anomalias.email_inmediato_habilitado" },
            data: { valor: "false" },
        });
        await sembrarDataset();
        const resumen = await ejecutarDeteccion(AHORA);

        expect(resumen.detectadas).toBe(3);
        expect(resumen.notificadas).toBe(0);
        expect(
            await prisma.notificacion.count({
                where: { evento: "analisis.anomalia.detectada" },
            })
        ).toBe(0);
    });

    it("fail-open: sin regla/plantillas de Motor Notif la anomalía se persiste igual", async () => {
        await prisma.notificacionRegla.deleteMany({});
        await prisma.notificacionPlantilla.deleteMany({});
        await sembrarDataset();

        const resumen = await ejecutarDeteccion(AHORA);
        expect(resumen.detectadas).toBe(3);
        expect(resumen.notificadas).toBe(0);
        expect(await prisma.anomalia.count()).toBe(3);
    });

    it("sin usuarios ADMIN activos la anomalía se persiste y no hay error", async () => {
        await sembrarDataset();
        await prisma.usuario.updateMany({ where: { rol: "ADMIN" }, data: { estado: "inactivo" } });

        const resumen = await ejecutarDeteccion(AHORA);
        expect(resumen.errores).toEqual([]);
        expect(resumen.detectadas).toBe(3);
        expect(resumen.notificadas).toBe(0);
    });
});
