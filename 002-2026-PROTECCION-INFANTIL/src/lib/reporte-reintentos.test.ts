import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { guardarReintento, contarReintentos, obtenerReintentos } from "./reporte-reintentos";

describe("reporte-reintentos", () => {
    let reporteId: string;

    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();

        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300REINT",
                plataformaId: plataforma!.id,
                texto: "Texto de prueba suficientemente largo para no ser spam y describe un incidente con un menor.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-REINT",
                estado: "PENDIENTE",
            },
        });
        reporteId = reporte.id;
    });

    it("registra un intento fallido", async () => {
        await guardarReintento({ reporteId, intento: 1, exitoso: false, error: "Ollama no disponible" });
        const reintentos = await obtenerReintentos(reporteId);
        expect(reintentos).toHaveLength(1);
        expect(reintentos[0].intento).toBe(1);
        expect(reintentos[0].exitoso).toBe(false);
        expect(reintentos[0].error).toBe("Ollama no disponible");
    });

    it("actualiza un intento existente al finalizar", async () => {
        await guardarReintento({ reporteId, intento: 1, exitoso: false });
        await guardarReintento({ reporteId, intento: 1, exitoso: true });
        const reintentos = await obtenerReintentos(reporteId);
        expect(reintentos).toHaveLength(1);
        expect(reintentos[0].exitoso).toBe(true);
    });

    it("mantiene historial de múltiples intentos", async () => {
        await guardarReintento({ reporteId, intento: 1, exitoso: false, error: "Error 1" });
        await guardarReintento({ reporteId, intento: 2, exitoso: false, error: "Error 2" });
        await guardarReintento({ reporteId, intento: 3, exitoso: false, error: "Error 3" });
        await guardarReintento({ reporteId, intento: 4, exitoso: true });

        const total = await contarReintentos(reporteId);
        expect(total).toBe(4);

        const reintentos = await obtenerReintentos(reporteId);
        expect(reintentos[3].intento).toBe(4);
        expect(reintentos[3].exitoso).toBe(true);
    });
});
