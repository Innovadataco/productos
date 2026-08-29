/**
 * SPEC-236 (002-PI-mega-cola): test de integración del seed del motor de
 * expediente (T016/T063): idempotencia de parámetros, 11 eventos con
 * plantillas ES y reglas, y renderizado con variables de ejemplo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedMotorExpediente } from "../../../../prisma/seed";
import { renderizarPlantilla } from "@/lib/notificaciones";

const EVENTOS = [
    "expediente.creado",
    "expediente.evento.agregado",
    "expediente.gravedad.subio_a_rojo",
    "expediente.consolidacion.solicitada",
    "expediente.comite.aprobo",
    "expediente.aclaracion.solicitada",
    "expediente.aclaracion.respondida",
    "expediente.cerrado",
    "expediente.escalado",
    "expediente.auto_cerrado_inactividad",
    "expediente.comite.sla_vencido",
];

describe("seedMotorExpediente (SPEC-236)", () => {
    beforeAll(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("siembra parámetros, 11 eventos con plantillas ES y reglas", async () => {
        await seedMotorExpediente();

        const tickMin = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.expediente.motor.tick_min" },
        });
        expect(tickMin?.valor).toBe("15");
        const retencion = await prisma.parametroSistema.findUnique({
            where: { clave: "padre.expediente.retencion_cerrados_meses" },
        });
        expect(retencion?.valor).toBe("24");

        for (const evento of EVENTOS) {
            const email = await prisma.notificacionPlantilla.findUnique({ where: { clave: `${evento}.email` } });
            expect(email, `${evento}.email`).not.toBeNull();
            expect(email?.activa).toBe(true);
            expect(email?.cuerpoMarkdown).toMatch(/\{\{[a-zA-Z]+\}\}/);
            const inApp = await prisma.notificacionPlantilla.findUnique({ where: { clave: `${evento}.in_app` } });
            expect(inApp, `${evento}.in_app`).not.toBeNull();

            const reglas = await prisma.notificacionRegla.findMany({ where: { evento } });
            expect(reglas.length, `reglas de ${evento}`).toBeGreaterThanOrEqual(2);
        }
    });

    it("es idempotente: la segunda corrida no duplica registros", async () => {
        await seedMotorExpediente();
        const plantillasAntes = await prisma.notificacionPlantilla.count();
        const reglasAntes = await prisma.notificacionRegla.count();
        const paramsAntes = await prisma.parametroSistema.count();

        await seedMotorExpediente();
        expect(await prisma.notificacionPlantilla.count()).toBe(plantillasAntes);
        expect(await prisma.notificacionRegla.count()).toBe(reglasAntes);
        expect(await prisma.parametroSistema.count()).toBe(paramsAntes);
    });

    it("las plantillas renderizan con variables del ciclo de vida", async () => {
        await seedMotorExpediente();
        const plantilla = await prisma.notificacionPlantilla.findUnique({
            where: { clave: "expediente.comite.sla_vencido.email" },
        });
        expect(plantilla).not.toBeNull();

        const render = renderizarPlantilla(plantilla!.cuerpoMarkdown, plantilla!.asunto, {
            expedienteId: "exp-123",
            estadoDestino: "PENDIENTE_COMITE",
            estadoAnterior: "CONSOLIDANDO",
            actor: "worker",
            motivo: "SLA vencido",
            scoreGravedadActual: "ROJO",
            fechaLimite: "2026-08-24T10:00:00-05:00",
            urlExpediente: "/dashboard/expedientes/exp-123",
        });
        expect(render.cuerpo).toContain("exp-123");
        expect(render.cuerpo).toContain("2026-08-24T10:00:00-05:00");
        expect(render.cuerpo).toContain("ROJO");
        expect(render.cuerpo).not.toMatch(/\{\{/);
    });
});
