import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { registrarTransicion } from "./reporte-transiciones";
import { resetDatabase } from "./test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "./reporte-test-utils";

async function crearReporteDePrueba(estado: "PENDIENTE" | "PROCESANDO" | "REVISION_MANUAL" = "PENDIENTE") {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma.id,
            texto: "Texto de prueba para reporte de transiciones con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${Date.now()}`,
            estado,
        },
    });
}

describe("registrarTransicion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("crea una transición cuando el estado anterior coincide", async () => {
        const reporte = await crearReporteDePrueba("PENDIENTE");
        const operador = await crearUsuario("OPERADOR");

        const transicion = await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "PENDIENTE",
            estadoNuevo: "PROCESANDO",
            responsableTipo: "WORKER",
            motivo: "Inicio de procesamiento",
        });

        expect(transicion.reporteId).toBe(reporte.id);
        expect(transicion.estadoAnterior).toBe("PENDIENTE");
        expect(transicion.estadoNuevo).toBe("PROCESANDO");
        expect(transicion.responsableTipo).toBe("WORKER");
        expect(transicion.responsableId).toBeNull();
        expect(transicion.motivo).toBe("Inicio de procesamiento");
    });

    it("asocia el responsableId cuando se proporciona", async () => {
        const reporte = await crearReporteDePrueba("REVISION_MANUAL");
        const operador = await crearUsuario("OPERADOR");

        const transicion = await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "REVISION_MANUAL",
            estadoNuevo: "CORREGIDO",
            responsableTipo: "OPERADOR",
            responsableId: operador.id,
            motivo: "Corrección manual",
        });

        expect(transicion.responsableId).toBe(operador.id);
    });

    it("falla si el estado anterior no coincide con el estado actual del reporte", async () => {
        const reporte = await crearReporteDePrueba("PROCESANDO");

        await expect(
            registrarTransicion({
                reporteId: reporte.id,
                estadoAnterior: "PENDIENTE",
                estadoNuevo: "CLASIFICADO",
                responsableTipo: "IA",
            })
        ).rejects.toThrow(/no coincide/);
    });

    it("falla si el reporte no existe", async () => {
        await expect(
            registrarTransicion({
                reporteId: "cm00000000000000000000000",
                estadoAnterior: "PENDIENTE",
                estadoNuevo: "PROCESANDO",
                responsableTipo: "WORKER",
            })
        ).rejects.toThrow("Reporte no encontrado");
    });

    it("permite transiciones con el mismo estado anterior y nuevo", async () => {
        const reporte = await crearReporteDePrueba("REVISION_MANUAL");
        const operador = await crearUsuario("OPERADOR");

        const transicion = await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "REVISION_MANUAL",
            estadoNuevo: "REVISION_MANUAL",
            responsableTipo: "OPERADOR",
            responsableId: operador.id,
            motivo: "Escalamiento a comité",
        });

        expect(transicion.estadoAnterior).toBe("REVISION_MANUAL");
        expect(transicion.estadoNuevo).toBe("REVISION_MANUAL");
    });

    it("guarda metadatos opcionales", async () => {
        const reporte = await crearReporteDePrueba("PENDIENTE");

        const transicion = await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "PENDIENTE",
            estadoNuevo: "PROCESANDO",
            responsableTipo: "WORKER",
            metadatos: { latenciaMs: 120, intento: 1 },
        });

        expect(transicion.metadatos).toEqual({ latenciaMs: 120, intento: 1 });
    });
});
