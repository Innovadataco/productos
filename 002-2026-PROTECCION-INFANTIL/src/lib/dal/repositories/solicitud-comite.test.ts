/**
 * E-8 (LOTE 2): tests de crear/findPorReporteId/findPorNumero (escalación al comité).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { SolicitudComiteRepository } from "./solicitud-comite";

const TAG = Math.random().toString(36).slice(2, 8);

async function crearReporteDePrueba() {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador: `+57300${TAG}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba del repositorio de solicitudes con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${TAG}`,
            estado: "REVISION_MANUAL",
        },
    });
}

describe("SolicitudComiteRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("crea la solicitud y la encuentra por reporteId y por número", async () => {
        const reporte = await crearReporteDePrueba();
        const operador = await crearUsuario("OPERADOR");
        const repo = new SolicitudComiteRepository();

        const numero = `SOL-${TAG}`;
        const creada = await repo.crear({
            reporteId: reporte.id,
            numero,
            estado: "PENDIENTE",
            operadorId: operador.id,
            motivo: "motivo de prueba de escalación",
        });
        expect(creada.id).toBeTruthy();

        const porReporte = await repo.findPorReporteId(reporte.id);
        expect(porReporte).toMatchObject({ id: creada.id, numero, estado: "PENDIENTE" });

        const porNumero = await repo.findPorNumero(numero);
        expect(porNumero).toMatchObject({ id: creada.id, reporteId: reporte.id });

        expect(await repo.findPorReporteId("no-existe")).toBeNull();
        expect(await repo.findPorNumero("SOL-INEXISTENTE")).toBeNull();
    });
});
