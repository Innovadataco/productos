/**
 * SPEC-234 (002-PI-134): tests del orquestador compilarExpediente.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedParametrosPadre, seedParametrosSenalComunitaria } from "../../../../prisma/seed";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { compilarExpediente } from "./compilar-expediente";

let tmpDir: string;

async function crearExpedienteConEventos(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
    await prisma.plataforma.upsert({
        where: { clave: "instagram" },
        update: {},
        create: { clave: "instagram", nombre: "Instagram", categoria: "red_social" },
    });

    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: "+573001234567",
        plataformaId: "whatsapp",
    });

    const base = new Date("2026-08-01T00:00:00Z").getTime();
    const intervalosDias = [0, 10, 10, 2, 2];
    let acumulado = 0;
    for (let i = 0; i < intervalosDias.length; i++) {
        acumulado += intervalosDias[i] * 24 * 60 * 60 * 1000;
        const evento = await repo.agregarEvento({
            expedienteId: expediente.id,
            texto: `Evento ${i + 1}`,
            reporteACrear: {
                ciudad: "Bogotá",
                pais: "Colombia",
            },
        });
        await prisma.eventoExpediente.update({
            where: { id: evento.id },
            data: {
                fechaEvento: new Date(base + acumulado),
                categoriaDetectada: i < 3 ? "CONTACTO_INSISTENTE" : "SOLICITUD_ENCUENTRO",
                confianzaClasificacion: 0.7,
                plataforma: i % 2 === 0 ? "whatsapp" : "instagram",
            },
        });
    }
    return expediente;
}

describe("compilarExpediente", () => {
    beforeEach(async () => {
        await resetDatabase();
        tmpDir = mkdtempSync(path.join(os.tmpdir(), "pi-informes-"));
        process.env.INFORMES_STORAGE_DIR = tmpDir;
        await seedParametrosPadre();
        await seedParametrosSenalComunitaria();
    });

    it("genera un informe consolidado con score, patrones y PDF", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteConEventos(padre.id);

        const informe = await compilarExpediente(expediente.id, {
            generadoPorId: padre.id,
            timestampPdf: new Date("2026-08-22T12:00:00Z"),
        });

        expect(informe.expedienteId).toBe(expediente.id);
        expect(informe.versionSecuencial).toBe(1);
        expect(informe.scoreValor).toBeGreaterThan(0);
        expect(["VERDE", "AMARILLO", "ROJO"]).toContain(informe.scoreGravedad);
        expect(informe.pdfHash).toBeDefined();
        expect(informe.pdfUrl).toContain(tmpDir);
        expect(existsSync(informe.pdfUrl!)).toBe(true);

        const patrones = await prisma.patronExpediente.findMany({
            where: { expedienteId: expediente.id },
        });
        expect(patrones.length).toBeGreaterThanOrEqual(1);

        const audits = await prisma.auditLog.findMany({
            where: { recursoId: informe.id },
        });
        expect(audits.map((a) => a.accion)).toContain("INFORME_CONSOLIDADO_CREADO");
        expect(audits.map((a) => a.accion)).toContain("PDF_GENERADO");
    });

    it("crea versiones secuenciales en compilaciones sucesivas", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteConEventos(padre.id);

        const v1 = await compilarExpediente(expediente.id);
        const v2 = await compilarExpediente(expediente.id);

        expect(v1.versionSecuencial).toBe(1);
        expect(v2.versionSecuencial).toBe(2);
        expect(v1.pdfHash).not.toBe(v2.pdfHash);
    });
});
