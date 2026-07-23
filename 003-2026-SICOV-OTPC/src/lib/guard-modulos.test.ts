import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuarioModulo: { findMany: vi.fn() },
    rolModulo: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { requiereModulo } from "./guard-modulos";
import { AppError } from "./errors";

const usuarioModuloFindMany = prisma.usuarioModulo.findMany as unknown as ReturnType<typeof vi.fn>;
const rolModuloFindMany = prisma.rolModulo.findMany as unknown as ReturnType<typeof vi.fn>;

const modulo = (nombre: string) => ({
  modulo: { id: 1, nombre, nombreMostrar: nombre, ruta: `/dashboard/${nombre}`, icono: null, orden: 1 },
});

beforeEach(() => {
  usuarioModuloFindMany.mockReset().mockResolvedValue([]);
  rolModuloFindMany.mockReset().mockResolvedValue([]);
});

describe("guard de módulos (D-017 — corrige I-09)", () => {
  it("usuario SIN el módulo → 403 (el permiso ya no es decorado de menú)", async () => {
    rolModuloFindMany.mockResolvedValue([modulo("salidas")]);
    await expect(requiereModulo({ id: 3, rolId: 3 }, "mantenimientos")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("usuario CON el módulo (vía rol) pasa", async () => {
    rolModuloFindMany.mockResolvedValue([modulo("salidas"), modulo("mantenimientos")]);
    await expect(requiereModulo({ id: 3, rolId: 3 }, "mantenimientos")).resolves.toBeUndefined();
  });

  it("asignación personalizada (usuarios_modulos) prevalece sobre la del rol", async () => {
    usuarioModuloFindMany.mockResolvedValue([modulo("llegadas")]);
    rolModuloFindMany.mockResolvedValue([modulo("salidas")]);
    await expect(requiereModulo({ id: 5, rolId: 3 }, "llegadas")).resolves.toBeUndefined();
    await expect(requiereModulo({ id: 5, rolId: 3 }, "salidas")).rejects.toBeInstanceOf(AppError);
  });

  it("rol 1 (root de plataforma) pasa el guard sin consultar módulos", async () => {
    await expect(requiereModulo({ id: 1, rolId: 1 }, "mantenimientos")).resolves.toBeUndefined();
    expect(usuarioModuloFindMany).not.toHaveBeenCalled();
  });

  it("rol nulo sin asignaciones → 403", async () => {
    await expect(requiereModulo({ id: 9, rolId: null }, "salidas")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
