import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { buscarHibrida } from "./hibrida";
import { PARAMETROS_RAG_DEFAULT } from "@/lib/ragConfig";

const BASE = {
  query: "tarifas de taxi",
  filtros: {},
  parametros: PARAMETROS_RAG_DEFAULT,
  embeddingModel: "nomic-embed-text",
  enrichConfig: "none",
  queryEmbedding: [0.1, 0.2, 0.3] as number[] | null,
};

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset();
  vi.mocked(prisma.documentoOficial.findMany).mockReset();
});

describe("buscarHibrida (spec 003, US4)", () => {
  it("ejecuta ambas ramas y fusiona; cada documento una sola vez (FR-014)", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ documentoId: "d1" }, { documentoId: "d2" }] as never) // FTS
      .mockResolvedValueOnce([{ documentoId: "d1" }, { documentoId: "d3" }] as never); // vectorial
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([
      { id: "d1", titulo: "Uno" },
      { id: "d2", titulo: "Dos" },
      { id: "d3", titulo: "Tres" },
    ] as never);

    const r = await buscarHibrida(prisma as never, BASE);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2); // FTS + vectorial
    const ids = r.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length); // sin duplicados
    // d1 está en ambas ramas: debe encabezar y marcar "ambas"
    expect(r[0].id).toBe("d1");
    expect(r[0].fuente).toBe("ambas");
    expect(typeof r[0].score).toBe("number");
  });

  it("sin embedding de consulta ejecuta SOLO la rama FTS (degradación útil, US4-4)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ documentoId: "d1" }] as never);
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([{ id: "d1", titulo: "Uno" }] as never);

    const r = await buscarHibrida(prisma as never, { ...BASE, queryEmbedding: null });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1); // solo FTS
    expect(r[0].fuente).toBe("fts");
  });

  it("devuelve [] sin tocar findMany cuando ninguna rama trae resultados", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const r = await buscarHibrida(prisma as never, BASE);

    expect(r).toEqual([]);
    expect(prisma.documentoOficial.findMany).not.toHaveBeenCalled();
  });

  it("la rama vectorial filtra por modelo + enriquecimiento vigentes (FR-021b, SC-022)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await buscarHibrida(prisma as never, { ...BASE, embeddingModel: "modelo-x", enrichConfig: "campos:tipo" });

    // La segunda llamada ($queryRaw vectorial) lleva el modelo y el enrich como parámetros.
    const sqlVectorial = vi.mocked(prisma.$queryRaw).mock.calls[1][0];
    expect(sqlVectorial.values).toContain("modelo-x");
    expect(sqlVectorial.values).toContain("campos:tipo");
  });

  it("preserva el orden RRF al hidratar los documentos", async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ documentoId: "d2" }, { documentoId: "d1" }] as never)
      .mockResolvedValueOnce([{ documentoId: "d1" }] as never); // d1 en ambas → sube
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([
      { id: "d1", titulo: "Uno" },
      { id: "d2", titulo: "Dos" },
    ] as never);

    const r = await buscarHibrida(prisma as never, BASE);

    expect(r[0].id).toBe("d1"); // aparece en ambas ramas: mayor score RRF
  });
});
