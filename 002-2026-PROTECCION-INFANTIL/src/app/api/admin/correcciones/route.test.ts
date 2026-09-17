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
const mockPublishEmbeddingBackfill = vi.fn().mockResolvedValue(undefined);
const mockGenerarEmbedding = vi.fn().mockResolvedValue(new Array(768).fill(0.01));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/ai/anonimizador", () => ({
    anonimizarTexto: (...args: unknown[]) => mockAnonimizar(...args),
}));

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockGenerarEmbedding(...args),
}));

vi.mock("@/lib/queue", () => ({
    publishDatasetEmbeddingBackfill: (...args: unknown[]) => mockPublishEmbeddingBackfill(...args),
}));

describe("POST /api/admin/correcciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        mockAnonimizar.mockReset();
        mockPublishEmbeddingBackfill.mockReset().mockResolvedValue(undefined);
        mockGenerarEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.01));
    });

    async function setupReporteAsignadoAOperador(estado: "REVISION_MANUAL" | "CLASIFICADO" = "REVISION_MANUAL") {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: "+57300CORRECCION",
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                operadorId: operador.id,
                texto: "Mi hija recibió mensajes ofreciendo regalos.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-CORR001",
                estado,
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
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
        return { reporte, clasificacion, operador };
    }

    async function setupReporteConPii() {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: "+57300CORRECCION",
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                texto: "Mi hija María del colegio San José recibió mensajes ofreciendo regalos.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-CORR001",
                estado: "CLASIFICADO",
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                confianza: 0.85,
                contienePii: true,
                piiDetectada: ["María", "colegio San José"],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return { reporte, clasificacion };
    }

    it("guarda dataset anonimizado cuando la anonimización sincrónica funciona", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupReporteConPii();

        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija [NOMBRE] del [COLEGIO] recibió mensajes ofreciendo regalos.",
            piiDetectada: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const dataset = await prisma.datasetEntrenamiento.findFirst({
            where: { fuente: "correccion_admin" },
        });
        expect(dataset).not.toBeNull();
        expect(dataset!.textoAnonimizado).toBe(true);
        expect(dataset!.texto).toContain("[NOMBRE]");
        // SPEC-702: ninguna copia se persiste sin anonimizar.
        expect(await prisma.datasetEntrenamiento.count({ where: { textoAnonimizado: false } })).toBe(0);

        const embedding = await prisma.embeddingDataset.findUnique({
            where: { datasetId: dataset!.id },
        });
        expect(embedding).not.toBeNull();
        expect(mockPublishEmbeddingBackfill).not.toHaveBeenCalled();
    });

    // SPEC-702 (I-422 p1) · CANDADO de conducta: si la anonimización falla, NO se guarda copia.
    // Antes se guardaba el relato en claro con textoAnonimizado=false y se encolaba un backfill;
    // eso se retiró. Ahora una corrección con anonimización fallida deja 0 filas nuevas, y NINGUNA
    // fila queda con textoAnonimizado=false. Control positivo: la corrección sí ocurre (200).
    it("CANDADO · anonimización fallida NO guarda copia: 0 filas, ninguna con textoAnonimizado=false", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupReporteConPii();

        // La anonimización del dataset falla (Ollama caído, timeout, etc.).
        mockAnonimizar.mockRejectedValue(new Error("Ollama no disponible"));

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        // La corrección misma SÍ se completa; solo se omite la copia de entrenamiento.
        expect(res.status).toBe(200);

        // Ninguna copia se guardó (ni cruda ni anonimizada): el relato en claro nunca entra.
        expect(await prisma.datasetEntrenamiento.count()).toBe(0);
        expect(await prisma.datasetEntrenamiento.count({ where: { textoAnonimizado: false } })).toBe(0);
        // Y no queda ningún embedding colgando de una copia inexistente.
        expect(await prisma.embeddingDataset.count()).toBe(0);

        // La corrección quedó registrada aunque la copia no: el reporte pasó a CORREGIDO.
        const reporteActualizado = await prisma.reporte.findUnique({
            where: { id: reporte.id },
            select: { estado: true },
        });
        expect(reporteActualizado?.estado).toBe("CORREGIDO");
    });

    it("deja el reporte en CORREGIDO y registra transición con responsable OPERADOR", async () => {
        const { operador, reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija recibió mensajes ofreciendo regalos.",
            piiDetectada: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const reporteActualizado = await prisma.reporte.findUnique({
            where: { id: reporte.id },
            select: { estado: true },
        });
        expect(reporteActualizado?.estado).toBe("CORREGIDO");

        const transicion = await prisma.transicionReporte.findFirst({
            where: { reporteId: reporte.id, estadoNuevo: "CORREGIDO" },
        });
        expect(transicion).not.toBeNull();
        expect(transicion?.responsableTipo).toBe("OPERADOR");
        expect(transicion?.responsableId).toBe(operador.id);
        expect(transicion?.estadoAnterior).toBe("REVISION_MANUAL");

        const correccion = await prisma.correccionAdmin.findFirst({
            where: { clasificacion: { reporteId: reporte.id } },
        });
        expect(correccion).not.toBeNull();
        expect(correccion?.categoriaOriginal).toBe("OFRECIMIENTO_REGALOS");
        expect(correccion?.categoriaCorregida).toBe("SOLICITUD_ENCUENTRO");
    });

    it("permite a un ADMIN corregir un reporte asignado a un operador", async () => {
        const admin = await crearUsuario("ADMIN");
        const { reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija recibió mensajes ofreciendo regalos.",
            piiDetectada: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const reporteActualizado = await prisma.reporte.findUnique({
            where: { id: reporte.id },
            select: { estado: true },
        });
        expect(reporteActualizado?.estado).toBe("CORREGIDO");
    });

    it("rechaza a un operador que no tiene el caso asignado con 403", async () => {
        const otroOperador = await crearUsuario("OPERADOR");
        const { reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(otroOperador.id, "OPERADOR");

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("rechaza a un usuario PARENT con 403", async () => {
        const parent = await crearUsuario("PARENT");
        const { reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("rechaza a un usuario COMITE_VALIDACION con 403", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        const { reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("rechaza corregir un reporte que ya fue corregido con 409", async () => {
        const { operador, reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija recibió mensajes ofreciendo regalos.",
            piiDetectada: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        const body = {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        };

        const req1 = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", body, mockToken);
        const res1 = await POST(req1);
        expect(res1.status).toBe(200);

        const req2 = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", body, mockToken);
        const res2 = await POST(req2);
        expect(res2.status).toBe(409);
    });

    it("rechaza corregir un reporte dado de baja con 409", async () => {
        const { operador, reporte } = await setupReporteAsignadoAOperador("REVISION_MANUAL");
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { eliminado: true, motivoBaja: "REPORTE_FALSO", notaBaja: "prueba" },
        });
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(409);
    });

    // El borrado en cascada de la copia (borrar corrección/reporte → 0 filas, sin huérfanas) + su
    // control positivo viven en el candado dedicado `dataset-erradicacion.candado.test.ts`.
});
