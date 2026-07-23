import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { vectorizarDocumento, type EmbedFn } from "./ingestChunks";
import { EMBEDDING_DIMS } from "./modelClients";
import { PARAMETROS_RAG_DEFAULT, type ModeloEmbeddingsResuelto } from "./ragConfig";

const MODELO: ModeloEmbeddingsResuelto = {
  id: "m1",
  modelPath: "nomic-embed-text",
  baseUrl: "http://ollama:11434",
  parametros: PARAMETROS_RAG_DEFAULT,
  enrichConfigHuella: "none",
};

const vec = () => Array.from({ length: EMBEDDING_DIMS }, () => 0.01);
const embedOk: EmbedFn = vi.fn(async () => ({ ok: true, embedding: vec(), latencyMs: 1 }));

function doc(contenidoTexto: string) {
  return { id: "doc1", contenidoTexto, tipo: "circular", numero: "114", entidad: "SuperTransporte" };
}

const largo = (marca: string) =>
  `${marca} ` + "disposición normativa aplicable al sector con suficiente extensión.".repeat(4);

describe("vectorizarDocumento (spec 003, US3)", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoChunk.deleteMany).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.$executeRaw).mockReset().mockResolvedValue(1 as never);
    vi.mocked(prisma.$transaction).mockClear();
    vi.mocked(embedOk).mockClear();
  });

  it("trocea, embebe y crea un chunk por fragmento con modelo y enriquecimiento", async () => {
    const texto = [largo("ARTÍCULO 1."), largo("ARTÍCULO 2.")].join("\n");

    const r = await vectorizarDocumento(prisma as never, doc(texto), MODELO, embedOk);

    expect(r.sinContenido).toBe(false);
    expect(r.chunksCreados).toBeGreaterThanOrEqual(2);
    expect(embedOk).toHaveBeenCalledTimes(r.chunksCreados);
    // un insert por fragmento
    expect(vi.mocked(prisma.$executeRaw)).toHaveBeenCalledTimes(r.chunksCreados);
  });

  it("guarda embeddingModel y enrichConfig en cada fragmento (FR-021/FR-026)", async () => {
    await vectorizarDocumento(prisma as never, doc(largo("ARTÍCULO 1.")), MODELO, embedOk);

    // Los valores viajan parametrizados; comprobamos que están entre los args del raw.
    const args = vi.mocked(prisma.$executeRaw).mock.calls[0];
    const planos = args.flat().map((v) => `${v}`);
    expect(planos).toContain("nomic-embed-text");
    expect(planos).toContain("none");
  });

  it("es idempotente: borra los previos dentro de la transacción antes de crear (FR-009)", async () => {
    await vectorizarDocumento(prisma as never, doc(largo("ARTÍCULO 1.")), MODELO, embedOk);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.documentoChunk.deleteMany).toHaveBeenCalledWith({ where: { documentoId: "doc1" } });
  });

  it("documento sin texto → 0 fragmentos, sin error de embeddings (US3-5)", async () => {
    const r = await vectorizarDocumento(prisma as never, doc("   "), MODELO, embedOk);

    expect(r).toEqual({ chunksCreados: 0, sinContenido: true });
    expect(embedOk).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    // limpia posibles chunks previos (documento que se vació al reprocesar)
    expect(prisma.documentoChunk.deleteMany).toHaveBeenCalledWith({ where: { documentoId: "doc1" } });
  });

  it("si un embedding falla, lanza y NO toca la base (el worker reintenta, FR-010)", async () => {
    const embedFalla: EmbedFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, embedding: vec(), latencyMs: 1 })
      .mockResolvedValueOnce({ ok: false, embedding: [], latencyMs: 1, error: "Ollama caído" });
    const texto = [largo("ARTÍCULO 1."), largo("ARTÍCULO 2.")].join("\n");

    await expect(
      vectorizarDocumento(prisma as never, doc(texto), MODELO, embedFalla),
    ).rejects.toThrow(/Ollama caído/);

    // Ni transacción ni inserts: el fallo ocurre antes de tocar la base.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("rechaza un vector de dimensión inesperada antes de persistir (FR-007)", async () => {
    const embedCorto: EmbedFn = vi.fn(async () => ({ ok: true, embedding: [0.1, 0.2], latencyMs: 1 }));

    await expect(
      vectorizarDocumento(prisma as never, doc(largo("ARTÍCULO 1.")), MODELO, embedCorto),
    ).rejects.toThrow();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
