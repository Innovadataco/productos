import { describe, it, expect, vi, beforeEach } from "vitest";

const cliente = {
  postTransaccional: vi.fn(),
  consultarIntegradora: vi.fn(),
  consultarRutasActivas: vi.fn(),
  consultarAutorizaciones: vi.fn(),
  postMantenimiento: vi.fn(),
  getMantenimiento: vi.fn(),
};

vi.mock("@/lib/integracion/cliente", () => ({ getClienteSupertransporte: () => cliente }));
vi.mock("@/lib/integracion/modo", () => ({ modoIntegracion: () => "stub" }));
vi.mock("@/lib/prisma", () => ({
  prisma: { apiLlamada: { create: vi.fn(async ({ data }: { data: unknown }) => ({ id: 500, ...(data as object) })) } },
}));

import { prisma } from "@/lib/prisma";
import { ejecutarOperacion } from "./ejecutar";

const create = prisma.apiLlamada.create as unknown as ReturnType<typeof vi.fn>;
const U = { id: 1, rolId: 1, identificacion: "900853057" };

beforeEach(() => {
  for (const fn of Object.values(cliente)) fn.mockReset();
  create.mockClear();
});

describe("ejecutarOperacion (013) — SOLO stub, siempre registra", () => {
  it("éxito: despacha por el cliente (stub) y registra modo=stub", async () => {
    cliente.postTransaccional.mockResolvedValue({ ok: true, id: 9001 });
    const r = await ejecutarOperacion("despachos", { obj_despacho: {} }, U);
    expect(cliente.postTransaccional).toHaveBeenCalledOnce();
    expect(r.modo).toBe("stub");
    expect(r.status).toBe(200);
    expect(r.logId).toBe(500);
    expect(create).toHaveBeenCalledOnce();
  });

  it("error del stub: registra la fila con status de error (nunca lanza sin registrar)", async () => {
    cliente.postTransaccional.mockRejectedValue(new Error("Fallo simulado FAL*"));
    const r = await ejecutarOperacion("llegadas", { placa: "FALLA01" }, U);
    expect(r.status).toBe(502);
    expect(r.error).toContain("Fallo simulado");
    expect(create).toHaveBeenCalledOnce();
  });

  it("redacta RECURSIVAMENTE el request antes de persistir (sin tokens en BD)", async () => {
    cliente.postTransaccional.mockResolvedValue({ ok: true });
    await ejecutarOperacion("despachos", { body: { dato: 1, headers: { Authorization: "Bearer secreto" } } }, U);
    const dataPersistida = create.mock.calls[0][0].data as { request: { body: { headers: { Authorization: string } } } };
    expect(dataPersistida.request.body.headers.Authorization).toBe("***");
  });

  it("operación inválida o pendiente → 400 (no registra basura)", async () => {
    await expect(ejecutarOperacion("no-existe", {}, U)).rejects.toMatchObject({ statusCode: 400 });
    await expect(ejecutarOperacion("alistamientos", {}, U)).rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it("maestras-rutas usa consultarRutasActivas con el NIT del payload", async () => {
    cliente.consultarRutasActivas.mockResolvedValue([]);
    await ejecutarOperacion("maestras-rutas", { nit: "900111222" }, U);
    expect(cliente.consultarRutasActivas).toHaveBeenCalledWith("900111222");
  });
});
