// Frontera del lector de decretos (fase C, C5b: src/datos-oficiales/decretos/leer.ts): solo corre en el servidor
// (server-only, primera importación), nunca nombra la fila cruda y rechaza fechas inválidas ANTES de tocar la base. Lo
// que lee lo prueba la integración (tests/integracion/decretos-cruce.test.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const candado = vi.hoisted(() => ({ cargado: false }));
vi.mock("server-only", () => {
  candado.cargado = true;
  return {};
});

const FUENTE = readFileSync(path.join(__dirname, "..", "..", "..", "..", "src", "datos-oficiales", "decretos", "leer.ts"), "utf8");
const IMPORTACION = /^(?:import|export)\s+(?!type\b)(?:[^"';()=]*?from\s+)?["']([^"']+)["']/gm;
const base = new Proxy({}, { get: () => { throw new Error("tocó la base"); } }) as unknown as PrismaClient;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("decretos · lector (frontera)", () => {
  it("carga server-only como primera importación", async () => {
    expect([...FUENTE.matchAll(IMPORTACION)].map((m) => m[1])[0]).toBe("server-only");
    await import("@/datos-oficiales/decretos/leer");
    expect(candado.cargado).toBe(true);
  });

  it("no nombra la fila cruda ni el crudo (select explícito)", () => {
    expect(FUENTE).not.toMatch(/\bfilaFuente\b|\bcrudo\b/);
    expect(FUENTE).toMatch(/select:/);
  });

  it("hoy o desde que no son fechas de negocio, o desde posterior a hoy: RangeError sin tocar la base", async () => {
    const { leerCruce, leerProximos } = await import("@/datos-oficiales/decretos/leer");
    const malas = [new Date("2027-06-09T05:00:00Z"), new Date(Number.NaN), "2027-06-09" as unknown as Date];
    for (const m of malas) {
      await expect(leerCruce(base, m, dia("2027-01-01"))).rejects.toThrow(RangeError);
      await expect(leerCruce(base, dia("2027-06-09"), m)).rejects.toThrow(RangeError);
      await expect(leerProximos(base, m)).rejects.toThrow(RangeError);
    }
    await expect(leerCruce(base, dia("2027-06-09"), dia("2027-06-10"))).rejects.toThrow(RangeError);
  });
});
