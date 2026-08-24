/**
 * SPEC-239 (002-PI-mega-cola): tests de integración del seed de emergencia
 * (T023/T024/T025): idempotencia del catálogo Motor Notif y renderizado de la
 * plantilla `expediente.emergencia.activada` con sus 5 variables (SC-006/SC-007).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { seedEmergenciaExpediente } from "../../../prisma/seed";
import { renderizarPlantilla } from "@/lib/notificaciones";

describe("seedEmergenciaExpediente (SPEC-239)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("siembra plantilla EMAIL y regla del evento con las 5 variables (FR-009)", async () => {
        await seedEmergenciaExpediente();

        const plantilla = await prisma.notificacionPlantilla.findUnique({
            where: { clave: "expediente.emergencia.activada.email" },
        });
        expect(plantilla).not.toBeNull();
        expect(plantilla?.canal).toBe("EMAIL");
        expect(plantilla?.activa).toBe(true);

        const regla = await prisma.notificacionRegla.findFirst({
            where: { evento: "expediente.emergencia.activada", canal: "EMAIL" },
        });
        expect(regla).not.toBeNull();
        expect(regla?.plantillaClave).toBe("expediente.emergencia.activada.email");
        expect(regla?.activa).toBe(true);
    });

    it("idempotente: ejecutarlo dos veces no duplica plantilla ni regla (SC-007)", async () => {
        await seedEmergenciaExpediente();
        await seedEmergenciaExpediente();

        const plantillas = await prisma.notificacionPlantilla.count({
            where: { clave: "expediente.emergencia.activada.email" },
        });
        expect(plantillas).toBe(1);

        const reglas = await prisma.notificacionRegla.count({
            where: { evento: "expediente.emergencia.activada", canal: "EMAIL" },
        });
        expect(reglas).toBe(1);
    });

    it("la plantilla renderiza las variables contactoNombre, relacion, telefono, expedienteNumero y padreNombre (SC-006)", async () => {
        await seedEmergenciaExpediente();
        const plantilla = await prisma.notificacionPlantilla.findUnique({
            where: { clave: "expediente.emergencia.activada.email" },
        });
        expect(plantilla).not.toBeNull();

        const { cuerpo } = renderizarPlantilla(plantilla!.cuerpoMarkdown, plantilla!.asunto, {
            contactoNombre: "María García",
            relacion: "MADRE",
            telefono: "+573001234567",
            expedienteNumero: "exp-123",
            padreNombre: "Carlos Pérez",
        });

        expect(cuerpo).toContain("María García");
        expect(cuerpo).toContain("MADRE");
        expect(cuerpo).toContain("+573001234567");
        expect(cuerpo).toContain("exp-123");
        expect(cuerpo).toContain("Carlos Pérez");
        expect(cuerpo).not.toContain("{{");
    });
});
