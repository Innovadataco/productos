import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mantenimiento: {
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    preventivo: { create: vi.fn(), update: vi.fn() },
    correctivo: { create: vi.fn(), update: vi.fn() },
    mantenimientoJob: { create: vi.fn() },
  },
}));
vi.mock("@/lib/integracion/cliente", () => ({ getClienteSupertransporte: vi.fn() }));
vi.mock("@/lib/integracion/contexto-usuario", () => ({
  resolverContextoEfectivo: vi.fn().mockResolvedValue({
    tokenAutorizado: "TOK",
    nitVigilado: "900853057",
    usuarioId: 2,
  }),
}));

import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { guardarBase, guardarDetalle, listarPlacas } from "./servicio";

const m = prisma.mantenimiento as unknown as Record<string, ReturnType<typeof vi.fn>>;
const prev = prisma.preventivo as unknown as Record<string, ReturnType<typeof vi.fn>>;
const job = prisma.mantenimientoJob.create as unknown as ReturnType<typeof vi.fn>;
const getCli = getClienteSupertransporte as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  for (const fn of Object.values(prev)) fn.mockReset();
  (prisma.correctivo.create as unknown as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue({ id: 21 });
  (prisma.correctivo.update as unknown as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({});
  job.mockReset().mockResolvedValue({ id: 77 });
  getCli.mockReset();
  m.updateMany.mockResolvedValue({ count: 1 });
  m.create.mockResolvedValue({ id: 10, placa: "ABC123", tipoId: 1 });
  m.update.mockResolvedValue({});
  prev.create.mockResolvedValue({ id: 20 });
  prev.update.mockResolvedValue({});
});

describe("guardarBase (US1)", () => {
  it("valida placa 3 letras + 3 dígitos y tipo operable", async () => {
    await expect(guardarBase({ vigiladoId: "1", placa: "AB123", tipoId: 1 }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
    await expect(guardarBase({ vigiladoId: "1", placa: "ABC123", tipoId: 3 }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
    await expect(guardarBase({ vigiladoId: "1", placa: "ABC123", tipoId: 9 }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("desactiva los previos, reporta inmediato y guarda id externo en columna SEPARADA", async () => {
    getCli.mockReturnValue({ postMantenimiento: vi.fn().mockResolvedValue({ id: 9001 }) });
    const r = await guardarBase({ vigiladoId: "900853057", placa: "abc123", tipoId: 1 }, "900853057", 2);
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: BigInt("900853057"), placa: "ABC123", tipoId: 1 } }),
    );
    expect(r.procesado).toBe(true);
    expect(r.mantenimientoIdExterno).toBe(9001);
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mantenimientoIdExterno: 9001 }) }),
    );
    expect(job).not.toHaveBeenCalled();
  });

  it("si el envío inmediato falla CAE A COLA (job base pendiente) sin perder el registro", async () => {
    getCli.mockReturnValue({ postMantenimiento: vi.fn().mockRejectedValue(new Error("Super caída")) });
    const r = await guardarBase({ vigiladoId: "900853057", placa: "ABC123", tipoId: 1 }, "900853057", 2);
    expect(r.procesado).toBe(false);
    expect(r.jobId).toBe(77);
    expect(r.mensaje).toContain("Encolado");
    expect(job).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "base", estado: "pendiente" }) }),
    );
  });

  it("modo diferido (carga masiva) NO llama al cliente: solo encola", async () => {
    const post = vi.fn();
    getCli.mockReturnValue({ postMantenimiento: post });
    const r = await guardarBase(
      { vigiladoId: "900853057", placa: "ABC123", tipoId: 2 },
      "900853057",
      2,
      { diferido: true },
    );
    expect(post).not.toHaveBeenCalled();
    expect(r.jobId).toBe(77);
  });
});

describe("guardarDetalle (US1)", () => {
  it("valida mantenimientoId entero, hora HH:mm y tipoIdentificacion 1..12", async () => {
    await expect(guardarDetalle(1, { mantenimientoId: "x" }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
    await expect(guardarDetalle(1, { mantenimientoId: 10, hora: "8:75" }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
    await expect(guardarDetalle(1, { mantenimientoId: 10, hora: "24:00" }, "u", 3)).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      guardarDetalle(1, { mantenimientoId: 10, hora: "08:30", tipoIdentificacion: 13 }, "u", 3),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("reporta con id EXTERNO del base y conserva el enlace local (gate B1)", async () => {
    m.findUnique.mockResolvedValue({ id: 10, placa: "ABC123", mantenimientoIdExterno: 9001 });
    const post = vi.fn().mockResolvedValue({ mantenimientoId: 9001 });
    getCli.mockReturnValue({ postMantenimiento: post });
    const r = await guardarDetalle(
      1,
      { mantenimientoId: 10, hora: "08:30", fecha: "2026-07-20", nit: "900555444", tipoIdentificacion: 1 },
      "900853057",
      2,
    );
    expect(prev.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mantenimientoId: 10 }) }),
    );
    expect(post).toHaveBeenCalledWith(
      "/guardar-preventivo",
      expect.objectContaining({ mantenimientoId: 9001 }),
      "900853057",
      2,
      { conVigiladoId: true },
    );
    expect(r.procesado).toBe(true);
    // el update marca procesado y guarda el externo SIN tocar mantenimientoId local
    const dataUpdate = prev.update.mock.calls[0][0].data;
    expect(dataUpdate.mantenimientoIdExterno).toBe(9001);
    expect(dataUpdate).not.toHaveProperty("mantenimientoId");
  });

  it("base sin sincronizar → cae a cola sin reportar (dependencia base→detalle)", async () => {
    m.findUnique.mockResolvedValue({ id: 10, placa: "ABC123", mantenimientoIdExterno: null });
    const post = vi.fn();
    getCli.mockReturnValue({ postMantenimiento: post });
    const r = await guardarDetalle(2, { mantenimientoId: 10, hora: "08:30" }, "900853057", 2);
    expect(post).not.toHaveBeenCalled();
    expect(r.procesado).toBe(false);
    expect(r.jobId).toBe(77);
  });

  it("base inexistente → 404", async () => {
    m.findUnique.mockResolvedValue(null);
    await expect(guardarDetalle(1, { mantenimientoId: 999 }, "u", 3)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("consultas proxy (US1)", () => {
  it("listarPlacas usa el NIT efectivo server-side (D-015)", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    getCli.mockReturnValue({ getMantenimiento: get });
    await listarPlacas(1, "1010101010", 3);
    expect(get).toHaveBeenCalledWith(
      "/listar-placas",
      { vigiladoId: "900853057", tipoId: "1" },
      "1010101010",
      3,
    );
  });
});
