/**
 * E-8 (LOTE 2): tests de findPorReporteConResponsable (historial del caso).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { prisma } from "@/lib/prisma";
import { TransicionReporteRepository } from "./transicion-reporte";

const TAG = Math.random().toString(36).slice(2, 8);

async function crearReporteDePrueba() {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador: `+57300${TAG}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba del repositorio de transiciones con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${TAG}`,
            estado: "PROCESANDO",
        },
    });
}

describe("TransicionReporteRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve el historial ordenado con el responsable; filtra por tipo", async () => {
        const reporte = await crearReporteDePrueba();
        const operador = await crearUsuario("OPERADOR");
        const admin = await crearUsuario("ADMIN");
        // registrarTransicion valida el estado actual; la ruta lo cambia aparte.
        await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "PROCESANDO",
            estadoNuevo: "REVISION_MANUAL",
            responsableTipo: "SISTEMA",
        });
        await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "REVISION_MANUAL" } });
        await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "REVISION_MANUAL",
            estadoNuevo: "CLASIFICADO",
            responsableTipo: "OPERADOR",
            responsableId: operador.id,
        });
        await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "CLASIFICADO" } });
        await registrarTransicion({
            reporteId: reporte.id,
            estadoAnterior: "CLASIFICADO",
            estadoNuevo: "REVISION_MANUAL",
            responsableTipo: "ADMIN",
            responsableId: admin.id,
        });

        const repo = new TransicionReporteRepository();
        const todas = await repo.findPorReporteConResponsable(reporte.id);
        expect(todas).toHaveLength(3);
        expect(todas.map((t) => t.responsableTipo)).toEqual(["SISTEMA", "OPERADOR", "ADMIN"]);
        expect(todas[1].responsableUsuario).toMatchObject({ id: operador.id, rol: "OPERADOR" });
        expect(todas[0].responsableUsuario).toBeNull();

        const soloOperador = await repo.findPorReporteConResponsable(reporte.id, "OPERADOR");
        expect(soloOperador).toHaveLength(1);
        expect(soloOperador[0].responsableUsuario?.id).toBe(operador.id);

        expect(await repo.findPorReporteConResponsable("no-existe")).toEqual([]);
    });
});
