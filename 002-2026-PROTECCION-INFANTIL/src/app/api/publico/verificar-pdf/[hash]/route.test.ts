/**
 * SPEC-234 (002-PI-134): tests del endpoint público de verificación de PDF.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedParametrosPadre, seedParametrosSenalComunitaria } from "../../../../../../prisma/seed";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { compilarExpediente } from "@/lib/expediente/compilacion/compilar-expediente";
import { GET } from "./route";

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
    const evento = await repo.agregarEvento({ expedienteId: expediente.id, texto: "Evento" });
    await prisma.eventoExpediente.update({
        where: { id: evento.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", plataforma: "whatsapp" },
    });
    return expediente;
}

function requestGet(hash: string) {
    return new Request(`http://localhost:5005/api/publico/verificar-pdf/${hash}`, {
        method: "GET",
    });
}

describe("GET /api/publico/verificar-pdf/[hash]", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.INFORMES_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "pi-pdf-"));
        process.env.DISABLE_RATE_LIMIT = "true";
        await seedParametrosPadre();
        await seedParametrosSenalComunitaria();
    });

    it("devuelve metadatos cuando el hash existe", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteSimple(padre.id);
        const informe = await compilarExpediente(expediente.id);

        const response = await GET(requestGet(informe.pdfHash!), { params: Promise.resolve({ hash: informe.pdfHash! }) });
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.expedienteId).toBe(expediente.id);
        expect(body.versionSecuencial).toBe(1);
        expect(body.pdfGeneradoEn).toBeDefined();
    });

    it("devuelve 404 cuando el hash no existe", async () => {
        const response = await GET(requestGet("hash-inexistente-1234567890"), {
            params: Promise.resolve({ hash: "hash-inexistente-1234567890" }),
        });
        expect(response.status).toBe(404);
    });
});
