/**
 * SPEC-234 (002-PI-134): tests de generación determinista de PDF.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedParametrosPadre, seedParametrosSenalComunitaria } from "../../../../prisma/seed";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { compilarExpediente } from "../compilacion/compilar-expediente";
import { generarPdf } from "./generar-pdf";

async function crearExpedienteSimple(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: "+573009999999",
        plataformaId: "whatsapp",
    });
    const evento = await repo.agregarEvento({ expedienteId: expediente.id, texto: "Mensaje sospechoso" });
    await prisma.eventoExpediente.update({
        where: { id: evento.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", plataforma: "whatsapp" },
    });
    return expediente;
}

describe("generarPdf", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.INFORMES_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "pi-pdf-"));
        await seedParametrosPadre();
        await seedParametrosSenalComunitaria();
    });

    it("produce el mismo hash para el mismo contenido y timestamp", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteSimple(padre.id);
        const informe = await compilarExpediente(expediente.id, {
            timestampPdf: new Date("2026-08-22T12:00:00Z"),
        });

        const a = await generarPdf(informe, { timestamp: new Date("2026-08-22T12:00:00Z") });
        const b = await generarPdf(informe, { timestamp: new Date("2026-08-22T12:00:00Z") });

        expect(a.hash).toBe(b.hash);
        expect(a.buffer.length).toBeGreaterThan(0);
    });

    it("no incluye el texto original del reporte en el buffer", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteSimple(padre.id);
        const informe = await compilarExpediente(expediente.id);

        const { buffer } = await generarPdf(informe);
        const texto = buffer.toString("utf-8");
        expect(texto).not.toContain("Mensaje sospechoso");
    });
});
