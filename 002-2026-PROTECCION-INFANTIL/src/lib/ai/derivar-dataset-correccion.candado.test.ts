/**
 * SPEC-812 (pieza 1) · CANDADO del cableado de la marca: `datasetOmitidoEn` se setea SOLO en el
 * rechazo TIPADO (AnonimizacionRechazadaError), NUNCA en un fallo de TRANSPORTE.
 *
 * Es el control positivo de la afirmación central: «la marca solo en el rechazo deliberado». Si alguien
 * la pusiera también en el transporte, una corrección reintentable (Ollama caído) quedaría marcada como
 * «omitida a propósito» y la consulta de pendientes DEJARÍA de verla — un pendiente real perdido en
 * silencio. Por eso se prueban las DOS direcciones: rechazo marca, transporte no.
 *
 * Mockea SOLO el anonimizador (la IA), no Prisma: la corrección y la marca van contra la BD real.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { encryptParameter } from "@/lib/param-encryption";
import { AnonimizacionRechazadaError, AnonimizacionTransporteError } from "@/lib/ai/anonimizacion-errores";

vi.mock("@/lib/ai/anonimizador", () => ({ anonimizarTexto: vi.fn() }));
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { derivarDatasetDeCorreccion } from "@/lib/ai/derivar-dataset-correccion";

let contador = 0;

async function crearCorreccion(adminId: string, plataformaId: string): Promise<string> {
    contador += 1;
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+57300MK${String(contador).padStart(4, "0")}`,
            plataformaId,
            texto: "Texto de prueba para el cableado de la marca.",
            textoOriginal: encryptParameter("Texto original de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-MK${String(contador).padStart(4, "0")}`,
        },
    });
    const clasificacion = await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CONTACTO_INSISTENTE", confianza: 0.8, modeloUsado: "test-modelo", latenciaMs: 100 },
    });
    const correccion = await prisma.correccionAdmin.create({
        data: { clasificacionId: clasificacion.id, categoriaOriginal: "CONTACTO_INSISTENTE", categoriaCorregida: "CONTACTO_INSISTENTE", adminId },
    });
    return correccion.id;
}

// textoTrabajo === textoOriginalPlano ⟹ yaAnonimizado=false ⟹ se llama anonimizarTexto (que mockeamos).
const PARAMS_QUE_LLAMAN_A_ANONIMIZAR = { textoTrabajo: "t", textoOriginalPlano: "t", categoriaCorregida: "CONTACTO_INSISTENTE" as const };

describe("SPEC-812 · derivar marca datasetOmitidoEn SOLO en el rechazo tipado", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
    });

    it("RECHAZO tipado → setea datasetOmitidoEn y NO guarda fila de dataset", async () => {
        const admin = await crearUsuario("ADMIN");
        const pf = await crearPlataforma();
        const correccionId = await crearCorreccion(admin.id, pf.id);
        vi.mocked(anonimizarTexto).mockRejectedValueOnce(new AnonimizacionRechazadaError("resultado inusable"));

        await derivarDatasetDeCorreccion({ ...PARAMS_QUE_LLAMAN_A_ANONIMIZAR, correccionId });

        const c = await prisma.correccionAdmin.findUniqueOrThrow({ where: { id: correccionId } });
        expect(c.datasetOmitidoEn).not.toBeNull();
        expect(await prisma.datasetEntrenamiento.count({ where: { correccionId } })).toBe(0);
    });

    it("TRANSPORTE → NO setea datasetOmitidoEn (reintentable) y NO guarda fila", async () => {
        const admin = await crearUsuario("ADMIN");
        const pf = await crearPlataforma();
        const correccionId = await crearCorreccion(admin.id, pf.id);
        vi.mocked(anonimizarTexto).mockRejectedValueOnce(new AnonimizacionTransporteError("Ollama caído"));

        await derivarDatasetDeCorreccion({ ...PARAMS_QUE_LLAMAN_A_ANONIMIZAR, correccionId });

        const c = await prisma.correccionAdmin.findUniqueOrThrow({ where: { id: correccionId } });
        expect(c.datasetOmitidoEn).toBeNull();
        expect(await prisma.datasetEntrenamiento.count({ where: { correccionId } })).toBe(0);
    });
});
