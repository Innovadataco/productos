/**
 * CANDADO · SPEC-702 (I-422 p1) · ERRADICACIÓN de la copia de entrenamiento.
 *
 * El punto entero del cambio de FK (SET NULL → ON DELETE CASCADE, D-121 de Datos): una copia en
 * `DatasetEntrenamiento` es un dato DERIVADO del relato de un niño; no puede sobrevivir al borrado
 * de su origen. Antes quedaba HUÉRFANA (correccionId=NULL) fuera del alcance del borrado.
 *
 * Prueba la CONDUCTA, no el texto del schema:
 *  1. Borrar el Reporte erradica su copia Y su embedding (cadena Reporte→ClasificacionIA→
 *     CorreccionAdmin→DatasetEntrenamiento→EmbeddingDataset).
 *  2. Borrar solo la CorreccionAdmin erradica su copia Y su embedding.
 *  3. CONTROL POSITIVO: la copia de OTRO reporte NO borrado SOBREVIVE — la cascada está ACOTADA,
 *     no borra todo (si no, el test pasaría en vacío / por un `deleteMany` accidental).
 *  4. El huérfano histórico (correccionId=NULL) NO se borra al cascadear OTRA corrección — su
 *     supervivencia la decide Jelkin, no esta cascada.
 *
 * Sin la migración (FK en SET NULL) los puntos 1 y 2 quedarían con la copia viva y correccionId
 * en NULL → el candado se pone rojo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;
const mockAnonimizar = vi.fn();
const mockGenerarEmbedding = vi.fn().mockResolvedValue(new Array(768).fill(0.01));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));
vi.mock("@/lib/ai/anonimizador", () => ({ anonimizarTexto: (...a: unknown[]) => mockAnonimizar(...a) }));
vi.mock("@/lib/ai/embedder", () => ({ generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a) }));
vi.mock("@/lib/queue", () => ({ publishDatasetEmbeddingBackfill: vi.fn().mockResolvedValue(undefined) }));

/** Crea un reporte clasificado y lo CORRIGE por el route → deja su DatasetEntrenamiento + embedding. */
async function corregirReporte(sufijo: string, adminToken: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+573001${sufijo}`,
            plataformaId: plataforma!.id,
            usuarioId: usuario.id,
            texto: `Relato del caso ${sufijo}.`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            numeroSeguimiento: `RPT-ERR-${sufijo}`,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.85,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    mockAnonimizar.mockResolvedValue({
        textoAnonimizado: `Relato anonimizado ${sufijo}.`,
        piiDetectada: [],
        metrics: { modelo: "ornith:9b", latenciaMs: 500 },
    });
    const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
        reporteId: reporte.id,
        categoriaCorregida: "SOLICITUD_ENCUENTRO",
    }, adminToken);
    expect((await POST(req)).status).toBe(200);

    const dataset = await prisma.datasetEntrenamiento.findFirst({
        where: { correccion: { clasificacion: { reporteId: reporte.id } } },
    });
    expect(dataset).not.toBeNull();
    const embedding = await prisma.embeddingDataset.findUnique({ where: { datasetId: dataset!.id } });
    expect(embedding).not.toBeNull();
    return { reporte, datasetId: dataset!.id, correccionId: dataset!.correccionId! };
}

/** Un huérfano histórico: copia con correccionId=NULL (la fila que Jelkin decide aparte). */
async function crearHuerfano() {
    const row = await prisma.datasetEntrenamiento.create({
        data: {
            texto: "Copia histórica anonimizada sin corrección.",
            clasificacionCorrecta: "OTRO" as CategoriaConducta,
            fuente: "legacy",
            correccionId: null,
            textoAnonimizado: true,
        },
    });
    return row.id;
}

describe("SPEC-702 · CANDADO de erradicación de la copia de entrenamiento", () => {
    let adminToken: string;

    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        mockAnonimizar.mockReset();
        mockGenerarEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.01));
        const admin = await crearUsuario("ADMIN");
        adminToken = await crearTokenUsuario(admin.id, "ADMIN");
        mockToken = adminToken;
    });

    it("borrar el REPORTE erradica su copia y su embedding; otra copia y el huérfano sobreviven", async () => {
        const a = await corregirReporte("AAA", adminToken);
        const b = await corregirReporte("BBB", adminToken);
        const huerfanoId = await crearHuerfano();

        await prisma.reporte.delete({ where: { id: a.reporte.id } });

        // A: erradicado (copia + embedding).
        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: a.datasetId } })).toBeNull();
        expect(await prisma.embeddingDataset.findUnique({ where: { datasetId: a.datasetId } })).toBeNull();
        // CONTROL POSITIVO · B sobrevive (cascada acotada, no un borrado total).
        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: b.datasetId } })).not.toBeNull();
        expect(await prisma.embeddingDataset.findUnique({ where: { datasetId: b.datasetId } })).not.toBeNull();
        // El huérfano histórico no lo toca esta cascada.
        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: huerfanoId } })).not.toBeNull();
        // Y ninguna copia quedó huérfana por SET NULL.
        expect(await prisma.datasetEntrenamiento.count({ where: { correccionId: null, fuente: "correccion_admin" } })).toBe(0);
    });

    it("borrar solo la CORRECCIÓN erradica su copia y su embedding; otra copia y el huérfano sobreviven", async () => {
        const a = await corregirReporte("AAA", adminToken);
        const b = await corregirReporte("BBB", adminToken);
        const huerfanoId = await crearHuerfano();

        await prisma.correccionAdmin.delete({ where: { id: a.correccionId } });

        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: a.datasetId } })).toBeNull();
        expect(await prisma.embeddingDataset.findUnique({ where: { datasetId: a.datasetId } })).toBeNull();
        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: b.datasetId } })).not.toBeNull();
        expect(await prisma.embeddingDataset.findUnique({ where: { datasetId: b.datasetId } })).not.toBeNull();
        expect(await prisma.datasetEntrenamiento.findUnique({ where: { id: huerfanoId } })).not.toBeNull();
        expect(await prisma.datasetEntrenamiento.count({ where: { correccionId: null, fuente: "correccion_admin" } })).toBe(0);
    });
});
