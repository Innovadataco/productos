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

// SPEC-351 (T052): el verificador público también resuelve informes del colegio.
describe("GET /api/publico/verificar-pdf/[hash] · InformeCaso (SPEC-351)", () => {
    it("hash de InformeCaso → 200 con metadata segura (sin PII del sujeto); anónimo", async () => {
        const { crearColegioConAdmin, crearPlataforma, crearCurso, crearEstudiante, crearIdentificadorEstudiante } =
            await import("@/lib/reporte-test-utils");
        const { colegio, admin } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma("discord", "Discord", "mensajeria");
        const curso = await crearCurso(colegio.id);
        const estudiante = await crearEstudiante(curso.id, colegio.id);
        const identificador = await crearIdentificadorEstudiante(estudiante.id, { plataformaId: plataforma.id });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: identificador.valor, plataformaId: plataforma.id, texto: "x",
                fechaIncidente: new Date(), ciudad: "Bogotá", pais: "CO", estado: "CLASIFICADO",
            },
        });
        const alerta = await prisma.alertaColegio.create({
            data: {
                colegioId: colegio.id, reporteId: reporte.id, tipoSujeto: "ESTUDIANTE",
                identificadorEstudianteId: identificador.id,
                vencimientoSla: new Date(Date.now() + 48 * 3600 * 1000),
            },
        });
        const caso = await prisma.seguimientoCaso.create({ data: { colegioId: colegio.id, alertaId: alerta.id } });
        const informe = await prisma.informeCaso.create({
            data: {
                casoId: caso.id, numeroCorrelativo: 1, anio: 2026,
                pdfHash: "cafe".padEnd(64, "1"), codigoVerificacion: "abcdef0123456789",
                firmadoPorNombre: "Rector Verificable", firmadoPorDocumento: "999",
                firmadoPorId: admin.id, seccionesJson: ["hechos"],
            },
        });

        const response = await GET(requestGet(informe.pdfHash), { params: Promise.resolve({ hash: informe.pdfHash }) });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.tipo).toBe("informe_colegio");
        expect(body.numeroCorrelativo).toBe(1);
        expect(body.firmadoPorNombre).toBe("Rector Verificable");
        // Sin PII del sujeto ni identificadores.
        expect(JSON.stringify(body)).not.toContain(identificador.valor);
    });

    it("código de 16 hex del InformeCaso también resuelve", async () => {
        const informe = await prisma.informeCaso.findFirst({ where: { codigoVerificacion: "abcdef0123456789" } });
        if (!informe) return; // el test anterior corre primero en el mismo archivo
        const response = await GET(requestGet("abcdef0123456789"), { params: Promise.resolve({ hash: "abcdef0123456789" }) });
        expect(response.status).toBe(200);
    });
});
