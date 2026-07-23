import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { contarPendientes, ejecutarBackfill, type VectorizarFn } from "./backfill";

const MODELO = { modelPath: "nomic-embed-text", enrichConfigHuella: "none" };

function docPend(id: string) {
  return { id, contenidoTexto: "ARTÍCULO 1. Texto.", tipo: "decreto", numero: "1", entidad: "MinT", fecha: "2020-01-01" };
}

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset();
});

describe("contarPendientes (spec 003, FR-021c, SC-017)", () => {
  it("cuenta los documentos activos con texto sin chunks del modelo+enriquecimiento vigentes", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ n: BigInt(7) }] as never);

    const n = await contarPendientes(prisma as never, MODELO);

    expect(n).toBe(7);
    // el modelo y el enrich viajan parametrizados
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[0][0];
    expect(sql.values).toContain("nomic-embed-text");
    expect(sql.values).toContain("none");
  });

  it("devuelve 0 sin pendientes", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ n: BigInt(0) }] as never);
    expect(await contarPendientes(prisma as never, MODELO)).toBe(0);
  });
});

describe("ejecutarBackfill (spec 003, US5, SC-006/SC-007)", () => {
  it("procesa solo los pendientes y suma fragmentos", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([docPend("d1"), docPend("d2")] as never);
    const vectorizar: VectorizarFn = vi.fn(async () => ({ chunksCreados: 3, sinContenido: false }));

    const p = await ejecutarBackfill(prisma as never, MODELO, vectorizar);

    expect(p.procesados).toBe(2);
    expect(p.fragmentos).toBe(6);
    expect(p.fallidos).toBe(0);
    expect(vectorizar).toHaveBeenCalledTimes(2);
  });

  it("es reanudable: sin pendientes no procesa nada (SC-007)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    const vectorizar: VectorizarFn = vi.fn();

    const p = await ejecutarBackfill(prisma as never, MODELO, vectorizar);

    expect(p).toEqual({ procesados: 0, omitidos: 0, fallidos: 0, fragmentos: 0 });
    expect(vectorizar).not.toHaveBeenCalled();
  });

  it("un documento que falla no detiene el backfill; se cuenta como fallido", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([docPend("d1"), docPend("d2"), docPend("d3")] as never);
    const vectorizar: VectorizarFn = vi
      .fn()
      .mockResolvedValueOnce({ chunksCreados: 2, sinContenido: false })
      .mockRejectedValueOnce(new Error("Ollama caído"))
      .mockResolvedValueOnce({ chunksCreados: 1, sinContenido: false });

    const p = await ejecutarBackfill(prisma as never, MODELO, vectorizar);

    expect(p.procesados).toBe(2);
    expect(p.fallidos).toBe(1);
    expect(p.fragmentos).toBe(3);
  });

  it("informa progreso tras cada documento", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([docPend("d1"), docPend("d2")] as never);
    const vectorizar: VectorizarFn = vi.fn(async () => ({ chunksCreados: 1, sinContenido: false }));
    const avances: number[] = [];

    await ejecutarBackfill(prisma as never, MODELO, vectorizar, (p) => avances.push(p.procesados));

    expect(avances).toEqual([1, 2]);
  });
});
