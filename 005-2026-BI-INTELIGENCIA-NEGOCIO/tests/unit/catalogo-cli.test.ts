// tests/unit/catalogo-cli.test.ts · Tests unitarios del CLI catalogo BI
// SPEC-010 · F3C 2026-08-28 · Autor: bi-dev-2
// Mock del cliente Prisma · sin conexión a BD real.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTablas,
  addTabla,
  addEjemplo,
  listConsultas,
  aprobarCache,
  listMetricas,
  getFlag,
  COMMANDS,
} from "../../scripts/catalogo-cli.mjs";

function mockPrisma() {
  return {
    bICatalogoTabla: {
      findMany: vi.fn().mockResolvedValue([
        { id: "t1", nombreFuente: "Reporte", nombreLegible: "Reportes", rolesPermitidos: ["ADMIN"], activo: true },
        { id: "t2", nombreFuente: "Colegio", nombreLegible: "Colegios", rolesPermitidos: ["ADMIN"], activo: true },
      ]),
      upsert: vi.fn().mockResolvedValue({ id: "t99", nombreFuente: "NuevaTabla" }),
    },
    bICatalogoEjemplo: {
      upsert: vi.fn().mockResolvedValue({ id: "e99", preguntaNL: "?" }),
    },
    bIConsultaLog: {
      findMany: vi.fn().mockResolvedValue([
        { id: "c1abc", usuarioId: "u1", preguntaNL: "test", estado: "ok", creadoEn: new Date("2026-08-28T12:00:00Z") },
      ]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "c1abc",
        preguntaNL: "test",
        sqlGenerado: "SELECT 1",
      }),
    },
    bICacheSemantico: {
      upsert: vi.fn().mockResolvedValue({ id: "cache99" }),
    },
    bICatalogoMetrica: {
      findMany: vi.fn().mockResolvedValue([
        { nombre: "reportes_hoy", nombreLegible: "Reportes hoy", categoria: "operativo", activa: true },
      ]),
    },
  };
}

describe("catalogo-cli · parser getFlag", () => {
  it("devuelve el valor si el flag esta presente", () => {
    expect(getFlag(["--x", "hola"], "--x")).toBe("hola");
  });
  it("devuelve undefined si el flag no esta", () => {
    expect(getFlag(["--a", "1"], "--x")).toBeUndefined();
  });
  it("devuelve undefined si el flag esta pero sin valor siguiente", () => {
    expect(getFlag(["--a"], "--a")).toBeUndefined();
  });
});

describe("catalogo-cli · list-tablas", () => {
  it("llama a findMany filtrando activas y ordenando por nombreFuente", async () => {
    const prisma = mockPrisma();
    const result = await listTablas(prisma as any);
    expect(prisma.bICatalogoTabla.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { nombreFuente: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0].nombreFuente).toBe("Reporte");
  });
});

describe("catalogo-cli · add-tabla", () => {
  it("hace upsert con los campos parseados de flags", async () => {
    const prisma = mockPrisma();
    await addTabla(prisma as any, ["NuevaTabla", "--legible", "Nueva", "--descripcion", "Desc", "--roles", "ADMIN,SCHOOL_ADMIN"]);
    expect(prisma.bICatalogoTabla.upsert).toHaveBeenCalledWith({
      where: { nombreFuente: "NuevaTabla" },
      create: expect.objectContaining({
        nombreFuente: "NuevaTabla",
        nombreLegible: "Nueva",
        descripcion: "Desc",
        rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"],
      }),
      update: expect.objectContaining({
        nombreLegible: "Nueva",
        descripcion: "Desc",
        rolesPermitidos: ["ADMIN", "SCHOOL_ADMIN"],
      }),
    });
  });
});

describe("catalogo-cli · list-consultas", () => {
  it("filtra por usuario y dias", async () => {
    const prisma = mockPrisma();
    await listConsultas(prisma as any, ["--usuario", "u1", "--dias", "3"]);
    expect(prisma.bIConsultaLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usuarioId: "u1",
          creadoEn: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        take: 50,
      }),
    );
  });

  it("sin --usuario no aplica filtro por usuarioId", async () => {
    const prisma = mockPrisma();
    await listConsultas(prisma as any, []);
    const call = (prisma.bIConsultaLog.findMany as any).mock.calls[0][0];
    expect(call.where.usuarioId).toBeUndefined();
  });
});

describe("catalogo-cli · aprobar-cache", () => {
  it("busca la consulta y hace upsert en bi_cache_semantico", async () => {
    const prisma = mockPrisma();
    await aprobarCache(prisma as any, ["c1abc"]);
    expect(prisma.bIConsultaLog.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "c1abc" },
    });
    expect(prisma.bICacheSemantico.upsert).toHaveBeenCalledWith({
      where: { preguntaNL: "test" },
      create: expect.objectContaining({
        preguntaNL: "test",
        sqlAprobado: "SELECT 1",
        aprobadoPor: "CLI",
        consultaLogId: "c1abc",
      }),
      update: expect.objectContaining({
        sqlAprobado: "SELECT 1",
        aprobadoPor: "CLI",
      }),
    });
  });
});

describe("catalogo-cli · add-ejemplo", () => {
  it("hace upsert idempotente por preguntaNL", async () => {
    const prisma = mockPrisma();
    await addEjemplo(prisma as any, ["--pregunta", "?", "--sql", "SELECT 1", "--categoria", "reportes"]);
    expect(prisma.bICatalogoEjemplo.upsert).toHaveBeenCalledWith({
      where: { preguntaNL: "?" },
      create: { preguntaNL: "?", sql: "SELECT 1", categoriaConsulta: "reportes" },
      update: { sql: "SELECT 1", categoriaConsulta: "reportes" },
    });
  });
});

describe("catalogo-cli · list-metricas", () => {
  it("filtra por activa=true y ordena por categoria+nombre", async () => {
    const prisma = mockPrisma();
    await listMetricas(prisma as any);
    expect(prisma.bICatalogoMetrica.findMany).toHaveBeenCalledWith({
      where: { activa: true },
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    });
  });
});

describe("catalogo-cli · COMMANDS registry", () => {
  it("expone los 6 comandos requeridos", () => {
    expect(Object.keys(COMMANDS).sort()).toEqual(
      ["add-ejemplo", "add-tabla", "aprobar-cache", "list-consultas", "list-metricas", "list-tablas"].sort(),
    );
  });
});
