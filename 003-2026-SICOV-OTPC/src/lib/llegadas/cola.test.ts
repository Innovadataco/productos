import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { llegadaSolicitud: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/integracion/cliente", () => ({ getClienteSupertransporte: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { procesarLoteLlegadas, reintentarLlegada } from "@/lib/llegadas/cola";

const findMany = prisma.llegadaSolicitud.findMany as unknown as ReturnType<typeof vi.fn>;
const update = prisma.llegadaSolicitud.update as unknown as ReturnType<typeof vi.fn>;
const getCli = getClienteSupertransporte as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  findMany.mockReset();
  update.mockReset();
  getCli.mockReset();
  update.mockResolvedValue({});
});

describe("procesarLoteLlegadas", () => {
  it("procesa una pendiente y guarda el id de llegada externo", async () => {
    findMany.mockResolvedValue([{ id: 1, payload: {}, usuarioId: "900853057", rolId: 2, reintentos: 0 }]);
    getCli.mockReturnValue({
      postTransaccional: vi.fn().mockResolvedValue({ obj: { idLlegada: 99 } }),
    });

    const r = await procesarLoteLlegadas({});
    expect(r.procesados).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ estado: "procesado", idLlegadaExterno: 99, procesado: true }),
      }),
    );
  });

  it("ante fallo reprograma con reintento (no queda atascado)", async () => {
    findMany.mockResolvedValue([{ id: 2, payload: {}, usuarioId: "900853057", rolId: 2, reintentos: 0 }]);
    getCli.mockReturnValue({
      postTransaccional: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const r = await procesarLoteLlegadas({ maxReintentos: 3 });
    expect(r.reprogramados).toBe(1);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "pendiente", reintentos: 1 }) }),
    );
  });

  it("agota reintentos y marca fallido", async () => {
    findMany.mockResolvedValue([{ id: 3, payload: {}, usuarioId: "900853057", rolId: 2, reintentos: 2 }]);
    getCli.mockReturnValue({
      postTransaccional: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const r = await procesarLoteLlegadas({ maxReintentos: 3 });
    expect(r.fallidos).toBe(1);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "fallido", reintentos: 3 }) }),
    );
  });
});

describe("reintentarLlegada", () => {
  it("resetea el contador a 0 y reencola", async () => {
    update.mockResolvedValue({ estado: "pendiente", reintentos: 0 });
    await reintentarLlegada(5);
    expect(update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ estado: "pendiente", reintentos: 0, procesado: false }),
    });
  });
});
