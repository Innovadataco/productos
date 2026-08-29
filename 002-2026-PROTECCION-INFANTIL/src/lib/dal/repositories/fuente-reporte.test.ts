/**
 * E-8: tests del FuenteReporteRepository — conteos por where, creación, peso y
 * purga por retención (la lógica de hash queda en el módulo anti-abuso).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma } from "@/lib/reporte-test-utils";
import { FuenteReporteRepository } from "./fuente-reporte";

const TAG = Math.random().toString(36).slice(2, 8).toUpperCase();
let contador = 0;

async function sembrarReporte(estado: "CLASIFICADO" | "POSIBLE_SPAM" = "CLASIFICADO") {
    const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
    contador += 1;
    return prisma.reporte.create({
        data: {
            identificador: `+57300FUE${TAG}`,
            plataformaId: plataforma.id,
            texto: "Texto del caso de la fuente con suficiente longitud.",
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-FUE-${TAG}-${contador}`,
            estado,
            eliminado: false,
        },
    });
}

describe("FuenteReporteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        // fuenteReporte no la limpia resetDatabase: se purga localmente.
        await prisma.fuenteReporte.deleteMany();
        await crearPlataforma();
    });

    it("contarPorWhere cuenta con el where ya construido; crear persiste la señal; actualizarFuenteConfianza escribe el peso", async () => {
        const reporte = await sembrarReporte();
        const repo = new FuenteReporteRepository();

        expect(await repo.contarPorWhere({ identificador: `+57300FUE${TAG}`, eliminado: false })).toBe(1);
        expect(await repo.contarPorWhere({ identificador: `+57300FUE${TAG}`, estado: "POSIBLE_SPAM" })).toBe(0);

        const fuente = await repo.crear({
            reporteId: reporte.id,
            ipHash: "hash-ip",
            fingerprintHash: "hash-fp",
            reportesPrevios: 0,
            reportesConfirmados: 0,
            reportesDescartados: 0,
            pesoAplicado: 1.5,
        });
        expect(fuente.reporteId).toBe(reporte.id);

        await repo.actualizarFuenteConfianza(reporte.id, 1.5);
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.fuenteConfianza).toBe(1.5);
    });

    it("purgarAntiguas borra solo las anteriores al límite y devuelve el conteo", async () => {
        const repo = new FuenteReporteRepository();
        const reporte = await sembrarReporte();
        await repo.crear({
            reporteId: reporte.id,
            ipHash: "vieja",
            fingerprintHash: "vieja",
            reportesPrevios: 0,
            reportesConfirmados: 0,
            reportesDescartados: 0,
            pesoAplicado: 1,
        });
        await prisma.fuenteReporte.updateMany({
            data: { creadoEn: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
        });
        const reporte2 = await sembrarReporte();
        await repo.crear({
            reporteId: reporte2.id,
            ipHash: "nueva",
            fingerprintHash: "nueva",
            reportesPrevios: 0,
            reportesConfirmados: 0,
            reportesDescartados: 0,
            pesoAplicado: 1,
        });

        const purgadas = await repo.purgarAntiguas(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
        expect(purgadas).toBe(1);
        expect(await prisma.fuenteReporte.count()).toBe(1);
    });
});
