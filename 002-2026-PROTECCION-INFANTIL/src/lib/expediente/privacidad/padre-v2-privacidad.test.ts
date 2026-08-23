/**
 * SPEC-234 (002-PI-134): tests de privacidad del módulo Padre v2.
 * Verifica que los modelos agregados y los entregables (resumen/PDF) no
 * contengan textos originales, identidades ni datos re-identificables.
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
import { compilarExpediente } from "@/lib/expediente/compilacion/compilar-expediente";
import { generarPdf } from "@/lib/expediente/pdf/generar-pdf";

const TEXTO_ORIGINAL = "Mensaje privado que no debe filtrarse";
const IDENTIFICADOR = "+573001234567";

const COLUMNAS_PROHIBIDAS = [
    "texto",
    "nombre",
    "telefono",
    "email",
    "direccion",
    "documento",
    "reporteId",
];

async function crearExpedienteConTexto(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });

    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: IDENTIFICADOR,
        plataformaId: "whatsapp",
    });

    const evento = await repo.agregarEvento({
        expedienteId: expediente.id,
        texto: TEXTO_ORIGINAL,
    });
    await prisma.eventoExpediente.update({
        where: { id: evento.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", plataforma: "whatsapp" },
    });

    return expediente;
}

async function nombresColumnas(tabla: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tabla}
    `;
    return rows.map((r) => r.column_name);
}

describe("privacidad de modelos agregados Padre v2", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.INFORMES_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "pi-priv-"));
        await seedParametrosPadre();
        await seedParametrosSenalComunitaria();
    });

    it("SenalComunitariaCache no tiene columnas prohibidas", async () => {
        const columnas = await nombresColumnas("senal_comunitaria_cache");
        for (const prohibida of COLUMNAS_PROHIBIDAS) {
            expect(columnas).not.toContain(prohibida);
        }
    });

    it("PatronExpediente no tiene columnas prohibidas", async () => {
        const columnas = await nombresColumnas("patrones_expediente");
        for (const prohibida of COLUMNAS_PROHIBIDAS) {
            expect(columnas).not.toContain(prohibida);
        }
    });

    it("resumenTextoGenerado no contiene texto original ni identificador", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteConTexto(padre.id);

        const informe = await compilarExpediente(expediente.id);

        expect(informe.resumenTextoGenerado).not.toContain(TEXTO_ORIGINAL);
        expect(informe.resumenTextoGenerado).not.toContain(IDENTIFICADOR);
    });

    it("PDF no contiene texto original ni identificador", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteConTexto(padre.id);

        const informe = await compilarExpediente(expediente.id);
        const { buffer } = await generarPdf(informe);
        const contenido = buffer.toString("utf-8");

        expect(contenido).not.toContain(TEXTO_ORIGINAL);
        expect(contenido).not.toContain(IDENTIFICADOR);
    });
});
