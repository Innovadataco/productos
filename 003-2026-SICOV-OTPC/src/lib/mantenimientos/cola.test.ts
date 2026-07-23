import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mantenimientoJob: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    mantenimiento: { findUnique: vi.fn(), update: vi.fn() },
    preventivo: { findUnique: vi.fn(), update: vi.fn() },
    correctivo: { findUnique: vi.fn(), update: vi.fn() },
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
import { procesarLoteMantenimientos, reintentarJob, listarJobs } from "./cola";

const jobs = prisma.mantenimientoJob as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mant = prisma.mantenimiento as unknown as Record<string, ReturnType<typeof vi.fn>>;
const prev = prisma.preventivo as unknown as Record<string, ReturnType<typeof vi.fn>>;
const getCli = getClienteSupertransporte as unknown as ReturnType<typeof vi.fn>;

const JOB_BASE = {
  id: 1,
  tipo: "base",
  mantenimientoLocalId: 10,
  detalleId: null,
  vigiladoId: "900853057",
  usuarioDocumento: "900853057",
  rolId: 2,
  estado: "pendiente",
  reintentos: 0,
  payload: { vigiladoId: 900853057, placa: "ABC123", tipoId: 1 },
};

beforeEach(() => {
  for (const fn of Object.values(jobs)) fn.mockReset();
  for (const fn of Object.values(mant)) fn.mockReset();
  for (const fn of Object.values(prev)) fn.mockReset();
  (prisma.correctivo.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  getCli.mockReset();
  jobs.update.mockResolvedValue({});
  mant.update.mockResolvedValue({});
  prev.update.mockResolvedValue({});
});

afterEach(() => vi.unstubAllEnvs());

describe("procesarLoteMantenimientos (US3)", () => {
  it("job base procesado: id EXTERNO en columna separada del local", async () => {
    jobs.findMany.mockResolvedValue([JOB_BASE]);
    mant.findUnique.mockResolvedValue({ id: 10, placa: "ABC123", tipoId: 1 });
    getCli.mockReturnValue({ postMantenimiento: vi.fn().mockResolvedValue({ id: 9001 }) });

    const r = await procesarLoteMantenimientos({});
    expect(r.procesados).toBe(1);
    expect(mant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ procesado: true, mantenimientoIdExterno: 9001 }),
      }),
    );
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "procesado" }) }),
    );
  });

  it("detalle con base SIN id externo → reprograma SIN consumir reintento (dependencia)", async () => {
    jobs.findMany.mockResolvedValue([{ ...JOB_BASE, id: 2, tipo: "preventivo", detalleId: 20 }]);
    prev.findUnique.mockResolvedValue({ id: 20, mantenimientoId: 10, placa: "ABC123" });
    mant.findUnique.mockResolvedValue({ id: 10, mantenimientoIdExterno: null });
    getCli.mockReturnValue({ postMantenimiento: vi.fn() });

    const r = await procesarLoteMantenimientos({});
    expect(r.reprogramados).toBe(1);
    const dataFinal = jobs.update.mock.calls.at(-1)?.[0].data;
    expect(dataFinal.estado).toBe("pendiente");
    expect(dataFinal).not.toHaveProperty("reintentos"); // sin consumir
  });

  it("detalle con base sincronizado: reporta con el id EXTERNO y conserva el enlace local", async () => {
    jobs.findMany.mockResolvedValue([{ ...JOB_BASE, id: 3, tipo: "preventivo", detalleId: 20, payload: { placa: "ABC123", hora: "08:30" } }]);
    prev.findUnique.mockResolvedValue({ id: 20, mantenimientoId: 10, placa: "ABC123", fecha: null, nit: null });
    mant.findUnique.mockResolvedValue({ id: 10, mantenimientoIdExterno: 9001 });
    const post = vi.fn().mockResolvedValue({ mantenimientoId: 9001 });
    getCli.mockReturnValue({ postMantenimiento: post });

    const r = await procesarLoteMantenimientos({});
    expect(r.procesados).toBe(1);
    expect(post).toHaveBeenCalledWith(
      "/guardar-preventivo",
      expect.objectContaining({ mantenimientoId: 9001 }),
      "900853057",
      2,
      { conVigiladoId: true },
    );
    const dataDetalle = prev.update.mock.calls[0][0].data;
    expect(dataDetalle.mantenimientoIdExterno).toBe(9001);
    expect(dataDetalle).not.toHaveProperty("mantenimientoId");
  });

  it("error normal consume reintento; al máximo (env) queda fallido", async () => {
    vi.stubEnv("COLA_MAX_REINTENTOS", "3");
    jobs.findMany.mockResolvedValue([{ ...JOB_BASE, reintentos: 2 }]);
    mant.findUnique.mockResolvedValue({ id: 10, placa: "ABC123", tipoId: 1 });
    getCli.mockReturnValue({ postMantenimiento: vi.fn().mockRejectedValue(new Error("boom")) });

    const r = await procesarLoteMantenimientos({});
    expect(r.fallidos).toBe(1);
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "fallido", reintentos: 3 }) }),
    );
  });

  it("tipos de 006/007 (alistamiento) → error explícito 'no soportado en 005'", async () => {
    jobs.findMany.mockResolvedValue([{ ...JOB_BASE, tipo: "alistamiento", reintentos: 0 }]);
    getCli.mockReturnValue({ postMantenimiento: vi.fn() });
    const r = await procesarLoteMantenimientos({});
    expect(r.reprogramados).toBe(1);
    expect(jobs.update.mock.calls.at(-1)?.[0].data.ultimoError).toContain("no soportado en 005");
  });
});

describe("reintentarJob (US3 — corregir y reenviar, §10.6)", () => {
  it("actualizar: corrige payload + datos locales, resetea reintentos=0 (ciclo nuevo)", async () => {
    jobs.findUnique.mockResolvedValue({ ...JOB_BASE, estado: "fallido", reintentos: 3 });
    const r = await reintentarJob(1, "900853057", 2, { accion: "actualizar", payload: { placa: "XYZ789" } });
    expect(r.estado).toBe("pendiente");
    expect(mant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 }, data: expect.objectContaining({ placa: "XYZ789" }) }),
    );
    expect(jobs.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: "pendiente", reintentos: 0, ultimoError: null }) }),
    );
  });

  it("reprogramar con reintentos al máximo → 409", async () => {
    jobs.findUnique.mockResolvedValue({ ...JOB_BASE, estado: "fallido", reintentos: 3 });
    await expect(reintentarJob(1, "900853057", 2, {})).rejects.toMatchObject({ statusCode: 409 });
  });

  it("job detalle con base fallido → opera sobre el base", async () => {
    jobs.findUnique.mockResolvedValue({ ...JOB_BASE, id: 5, tipo: "preventivo", detalleId: 20, estado: "pendiente" });
    jobs.findFirst.mockResolvedValue({ ...JOB_BASE, id: 4, estado: "fallido", reintentos: 1 });
    const r = await reintentarJob(5, "900853057", 2, { accion: "reprogramar" });
    expect(r.jobId).toBe(4);
    expect(jobs.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 4 } }));
  });

  it("job no fallido → retorno silencioso (paridad)", async () => {
    jobs.findUnique.mockResolvedValue({ ...JOB_BASE, estado: "procesado" });
    jobs.findFirst.mockResolvedValue(null);
    const r = await reintentarJob(1, "900853057", 2, {});
    expect(r.mensaje).toContain("Sin acción");
  });

  it("alcance D-015: un rol 2 NO alcanza jobs de otro NIT (404)", async () => {
    jobs.findUnique.mockResolvedValue({ ...JOB_BASE, vigiladoId: "999999999" });
    await expect(reintentarJob(1, "900853057", 2, {})).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("listarJobs (US3 — alcance D-015 server-side)", () => {
  it("rol 2/3: fuerza el NIT efectivo e IGNORA el nit del cliente", async () => {
    jobs.findMany.mockResolvedValue([]);
    await listarJobs("1010101010", 3, { nit: "999999999" });
    expect(jobs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vigiladoId: "900853057" }) }),
    );
  });

  it("rol 1: puede filtrar por nit o ver todas las empresas", async () => {
    jobs.findMany.mockResolvedValue([]);
    await listarJobs("800000001", 1, { nit: "999999999" });
    expect(jobs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vigiladoId: "999999999" }) }),
    );
    jobs.findMany.mockClear();
    jobs.findMany.mockResolvedValue([]);
    await listarJobs("800000001", 1, {});
    const whereSinNit = jobs.findMany.mock.calls[0][0].where;
    expect(whereSinNit).not.toHaveProperty("vigiladoId");
  });

  it("filtra por placa del payload y pagina en memoria", async () => {
    jobs.findMany.mockResolvedValue([
      { ...JOB_BASE, id: 1, payload: { placa: "ABC123" } },
      { ...JOB_BASE, id: 2, payload: { placa: "XYZ789" } },
    ]);
    const r = await listarJobs("900853057", 2, { placa: "XYZ" });
    expect(r.items).toHaveLength(1);
    expect(r.pagination.total).toBe(1);
  });
});
