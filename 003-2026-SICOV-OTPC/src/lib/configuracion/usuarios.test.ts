import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const tx = {
    usuario: { create: vi.fn(), update: vi.fn() },
    usuarioModulo: { deleteMany: vi.fn(), create: vi.fn() },
  };
  return {
    prisma: {
      usuario: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      usuarioModulo: { findMany: vi.fn() },
      modulo: { findFirst: vi.fn() },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      __tx: tx,
    },
  };
});
vi.mock("@/lib/auth", () => ({ hashPassword: vi.fn(async () => "HASH") }));
vi.mock("@/lib/correo/correo", () => ({ getCorreo: () => ({ enviarCorreo: vi.fn(async () => ({ ok: true, modo: "stub" })) }) }));

import { prisma } from "@/lib/prisma";
import { crearUsuario, actualizarUsuario } from "./usuarios";

const p = prisma as unknown as {
  usuario: Record<string, ReturnType<typeof vi.fn>>;
  usuarioModulo: { findMany: ReturnType<typeof vi.fn> };
  modulo: { findFirst: ReturnType<typeof vi.fn> };
  __tx: {
    usuario: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    usuarioModulo: { deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
};

// Otorgante rol 2 con: módulo 4 (mantenimientos) SOLO submódulo 40 (preventivos).
const ROL2 = { id: 2, rolId: 2, identificacion: "900853057" };
const MODULO_USUARIOS = { id: 8 };

beforeEach(() => {
  p.usuario.findFirst.mockReset().mockResolvedValue(null);
  p.usuario.findUnique.mockReset();
  p.usuario.findMany.mockReset();
  p.usuario.count.mockReset();
  p.modulo.findFirst.mockReset().mockResolvedValue(MODULO_USUARIOS);
  p.usuarioModulo.findMany.mockReset().mockResolvedValue([{ moduloId: 4, submoduloId: 40 }]);
  p.__tx.usuario.create.mockReset().mockResolvedValue({ id: 55 });
  p.__tx.usuario.update.mockReset().mockResolvedValue({});
  p.__tx.usuarioModulo.deleteMany.mockReset().mockResolvedValue({ count: 0 });
  p.__tx.usuarioModulo.create.mockReset().mockResolvedValue({ id: 1 });
});

describe("crearUsuario — cascada y B2 (US2)", () => {
  it("otorga un SUBMÓDULO que sí tiene → crea la fila puntual", async () => {
    const r = await crearUsuario(ROL2, {
      nombre: "Op", identificacion: "111", correo: "op@e.com", rolId: 3,
      permisos: [{ moduloId: 4, submoduloIds: [40] }],
    });
    expect(r.usuarioId).toBe(55);
    // B2: borra lo previo del módulo 4 y crea SOLO la fila de submódulo 40.
    expect(p.__tx.usuarioModulo.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 55, moduloId: 4 } });
    expect(p.__tx.usuarioModulo.create).toHaveBeenCalledWith({ data: { usuarioId: 55, moduloId: 4, submoduloId: 40, estado: true } });
  });

  it("403 si otorga un submódulo que NO tiene (subconjunto server-side)", async () => {
    await expect(
      crearUsuario(ROL2, { nombre: "Op", identificacion: "111", correo: "op@e.com", rolId: 3, permisos: [{ moduloId: 4, submoduloIds: [41] }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("403 si otorga el MÓDULO COMPLETO teniendo solo un submódulo", async () => {
    await expect(
      crearUsuario(ROL2, { nombre: "Op", identificacion: "111", correo: "op@e.com", rolId: 3, permisos: [{ moduloId: 4 }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("403 si asigna el módulo Usuarios a un operador (rol 3)", async () => {
    // Otorgante root (rol 1) para aislar la regla de rol 3.
    await expect(
      crearUsuario({ id: 1, rolId: 1, identificacion: null }, { nombre: "Op", identificacion: "111", correo: "op@e.com", rolId: 3, empresaNit: "900853057", permisos: [{ moduloId: 8 }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("409 si la identificación ya existe", async () => {
    p.usuario.findFirst.mockResolvedValue({ id: 9 });
    await expect(
      crearUsuario(ROL2, { nombre: "Op", identificacion: "111", correo: "op@e.com", rolId: 3, permisos: [] }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("B2 — módulo completo purga submódulos (root)", () => {
  it("asignar módulo completo crea UNA fila NULL tras borrar las previas", async () => {
    await crearUsuario(
      { id: 1, rolId: 1, identificacion: null },
      { nombre: "Op", identificacion: "222", correo: "o@e.com", rolId: 3, empresaNit: "900853057", permisos: [{ moduloId: 4 }] },
    );
    expect(p.__tx.usuarioModulo.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 55, moduloId: 4 } });
    expect(p.__tx.usuarioModulo.create).toHaveBeenCalledWith({ data: { usuarioId: 55, moduloId: 4, submoduloId: null, estado: true } });
    expect(p.__tx.usuarioModulo.create).toHaveBeenCalledTimes(1);
  });
});

describe("actualizarUsuario — alcance D-015", () => {
  it("rol 2 editando usuario de OTRO NIT → 404 (sin fuga)", async () => {
    p.usuario.findUnique.mockResolvedValue({ id: 77, administradorId: 111111111, rolId: 3 });
    await expect(actualizarUsuario(ROL2, 77, { nombre: "X" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rol 2 editando usuario de SU NIT → OK", async () => {
    p.usuario.findUnique.mockResolvedValue({ id: 77, administradorId: 900853057, rolId: 3 });
    await expect(actualizarUsuario(ROL2, 77, { nombre: "X" })).resolves.toBeUndefined();
    expect(p.__tx.usuario.update).toHaveBeenCalled();
  });
});
