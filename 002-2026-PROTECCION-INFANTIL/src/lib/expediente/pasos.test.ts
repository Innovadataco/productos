import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { registrarPaso } from "./pasos";
import { resetDatabase } from "../test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "../reporte-test-utils";

async function crearReporteDePrueba() {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma.id,
            texto: "Texto de prueba para pasos de procesamiento con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${Date.now()}`,
            estado: "PROCESANDO",
        },
    });
}

describe("registrarPaso", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("escribe un paso en BD y se puede leer", async () => {
        const reporte = await crearReporteDePrueba();

        await registrarPaso(reporte.id, "deduplicacion", {
            veredicto: "duplicado",
            detalle: { reporteOrigenId: "cm123", scoreSimilitud: 0.97 },
            latenciaMs: 42,
        });

        const pasos = await prisma.pasoProcesamiento.findMany({
            where: { reporteId: reporte.id },
        });
        expect(pasos).toHaveLength(1);
        expect(pasos[0].etapa).toBe("deduplicacion");
        expect(pasos[0].veredicto).toBe("duplicado");
        expect(pasos[0].detalle).toEqual({ reporteOrigenId: "cm123", scoreSimilitud: 0.97 });
        expect(pasos[0].latenciaMs).toBe(42);
        expect(pasos[0].creadoEn).toBeInstanceOf(Date);
    });

    it("permite pasos sin veredicto ni detalle", async () => {
        const reporte = await crearReporteDePrueba();

        await registrarPaso(reporte.id, "guardas");

        const pasos = await prisma.pasoProcesamiento.findMany({
            where: { reporteId: reporte.id },
        });
        expect(pasos).toHaveLength(1);
        expect(pasos[0].veredicto).toBeNull();
        expect(pasos[0].detalle).toBeNull();
        expect(pasos[0].latenciaMs).toBeNull();
    });

    it("no propaga el error cuando la escritura falla (FK de reporte inexistente)", async () => {
        await expect(
            registrarPaso("cm00000000000000000000000", "guardas", { veredicto: "sin_senal" })
        ).resolves.toBeUndefined();

        const pasos = await prisma.pasoProcesamiento.findMany();
        expect(pasos).toHaveLength(0);
    });
});
