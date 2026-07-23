import { describe, it, expect, vi, beforeEach } from "vitest";

const orden: string[] = [];

vi.mock("@/lib/prisma", () => {
  const tx = {
    proveedorVigilado: { create: vi.fn(), update: vi.fn() },
    usuario: { create: vi.fn(), updateMany: vi.fn() },
    usuarioModulo: { create: vi.fn() },
  };
  return {
    prisma: {
      proveedorVigilado: { findFirst: vi.fn() },
      usuario: { findFirst: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
        const r = await cb(tx);
        orden.push("commit");
        return r;
      }),
      __tx: tx,
    },
  };
});
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn(async () => "HASH") }));
vi.mock("@/lib/correo/correo", () => ({
  getCorreo: () => ({
    enviarCorreo: vi.fn(async () => {
      orden.push("correo");
      return { ok: true, modo: "stub" };
    }),
  }),
}));

import { prisma } from "@/lib/prisma";
import { crearEmpresa, modificarToken } from "./empresas";

const provFindFirst = prisma.proveedorVigilado.findFirst as unknown as ReturnType<typeof vi.fn>;
const userFindFirst = prisma.usuario.findFirst as unknown as ReturnType<typeof vi.fn>;
// @ts-expect-error delegados de la transacción expuestos por el mock
const tx = prisma.__tx as {
  proveedorVigilado: { create: ReturnType<typeof vi.fn> };
  usuario: { create: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  usuarioModulo: { create: ReturnType<typeof vi.fn> };
};

const TOKEN_UUID = "11111111-1111-1111-1111-111111111111";
const base = { empresa: "Transportes X", nit: "900111222", correo: "x@y.com", token: TOKEN_UUID, modulos: [1, 2] };

beforeEach(() => {
  orden.length = 0;
  provFindFirst.mockReset().mockResolvedValue(null);
  userFindFirst.mockReset().mockResolvedValue(null);
  tx.proveedorVigilado.create.mockReset().mockResolvedValue({ id: 10 });
  tx.usuario.create.mockReset().mockResolvedValue({ id: 20 });
  tx.usuario.updateMany?.mockReset?.();
  tx.usuarioModulo.create.mockReset().mockResolvedValue({ id: 30 });
});

describe("crearEmpresa (US1)", () => {
  it("crea proveedor + usuario rol 2 + módulos y envía correo DESPUÉS del commit", async () => {
    const r = await crearEmpresa(base);
    expect(r).toMatchObject({ proveedorId: 10, usuarioId: 20, correoEnviado: true });
    expect(tx.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rolId: 2, identificacion: "900111222", claveTemporal: true }) }),
    );
    expect(tx.usuarioModulo.create).toHaveBeenCalledTimes(2);
    // Correo SIEMPRE tras el commit (fuera de la transacción).
    expect(orden).toEqual(["commit", "correo"]);
  });

  it("409 por NIT/usuario ya existente (G3)", async () => {
    userFindFirst.mockResolvedValue({ id: 99 });
    await expect(crearEmpresa(base)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.proveedorVigilado.create).not.toHaveBeenCalled();
  });

  it("409 por token de empresa duplicado (G2, server-side)", async () => {
    provFindFirst.mockResolvedValue({ id: 7 }); // otro proveedor ya tiene el token
    await expect(crearEmpresa(base)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.usuario.create).not.toHaveBeenCalled();
  });

  it("400 por correo inválido (no crea nada)", async () => {
    await expect(crearEmpresa({ ...base, correo: "no-es-correo" })).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.proveedorVigilado.create).not.toHaveBeenCalled();
  });

  it("400 por token que no es UUID (tpv_token @db.Uuid)", async () => {
    await expect(crearEmpresa({ ...base, token: "no-es-uuid" })).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.proveedorVigilado.create).not.toHaveBeenCalled();
  });

  it("sin token → genera un UUID y crea la empresa", async () => {
    const r = await crearEmpresa({ ...base, token: undefined });
    expect(r.proveedorId).toBe(10);
    const dataProv = tx.proveedorVigilado.create.mock.calls[0][0].data as { token: string };
    expect(dataProv.token).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("modificarToken (US1)", () => {
  it("409 si el nuevo token lo tiene otra empresa (G2)", async () => {
    provFindFirst
      .mockResolvedValueOnce({ id: 10, documento: "900111222" }) // la empresa objetivo
      .mockResolvedValueOnce({ id: 7 }); // otra empresa con ese token
    await expect(modificarToken("900111222", "22222222-2222-2222-2222-222222222222")).rejects.toMatchObject({ statusCode: 409 });
  });
});
