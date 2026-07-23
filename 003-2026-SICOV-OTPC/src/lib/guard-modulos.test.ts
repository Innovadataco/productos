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

// Fila de submódulo puntual (como la devuelve cargarSubmodulos vía include).
const submodulo = (moduloNombre: string, nombre: string) => ({
  submodulo: {
    id: 1,
    nombre,
    nombreMostrar: nombre,
    modulo: { id: 1, nombre: moduloNombre },
  },
});

// `cargarModulos` y `cargarSubmodulos` usan el MISMO delegado `usuarioModulo.findMany`, pero con
// filtros distintos (submoduloId: {not:null} en el segundo). Enrutamos el mock por ese filtro.
function enrutarUsuarioModulo(porModulo: unknown[], porSubmodulo: unknown[]) {
  usuarioModuloFindMany.mockImplementation((args: { where?: { submoduloId?: unknown } }) => {
    const esSubmodulos = args?.where?.submoduloId !== undefined;
    return Promise.resolve(esSubmodulos ? porSubmodulo : porModulo);
  });
}

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

describe("guard extendido a submódulo (spec 009 — B1/B2)", () => {
  it("módulo COMPLETO (fila NULL: sin submódulos puntuales) → pasa cualquier submódulo", async () => {
    // Tiene el módulo mantenimientos y NINGUNA fila de submódulo → módulo completo.
    enrutarUsuarioModulo([modulo("mantenimientos")], []);
    await expect(
      requiereModulo({ id: 5, rolId: 3 }, "mantenimientos", "preventivos"),
    ).resolves.toBeUndefined();
    await expect(
      requiereModulo({ id: 5, rolId: 3 }, "mantenimientos", "correctivos"),
    ).resolves.toBeUndefined();
  });

  it("SOLO submódulo preventivos → pasa preventivos, 403 en correctivos", async () => {
    enrutarUsuarioModulo(
      [modulo("mantenimientos")],
      [submodulo("mantenimientos", "preventivos")],
    );
    await expect(
      requiereModulo({ id: 6, rolId: 3 }, "mantenimientos", "preventivos"),
    ).resolves.toBeUndefined();
    await expect(
      requiereModulo({ id: 6, rolId: 3 }, "mantenimientos", "correctivos"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("SIN el módulo → 403 aunque se pida un submódulo", async () => {
    enrutarUsuarioModulo([modulo("salidas")], []);
    await expect(
      requiereModulo({ id: 7, rolId: 3 }, "mantenimientos", "preventivos"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("guard de configuracion/apis: rol 1 pasa siempre; rol 3 sin el módulo → 403", async () => {
    await expect(
      requiereModulo({ id: 1, rolId: 1 }, "configuracion", "apis"),
    ).resolves.toBeUndefined();
    enrutarUsuarioModulo([modulo("mantenimientos")], []);
    await expect(
      requiereModulo({ id: 8, rolId: 3 }, "configuracion", "apis"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
