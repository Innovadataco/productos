// Candados de la frontera del motor: el lector y `proyectar` solo corren en el servidor (server-only); los módulos
// puros no traen Prisma en tiempo de ejecución ni nada del servidor (los puede importar la pantalla para los tipos y
// el aviso); los parámetros inválidos se rechazan ANTES de tocar la base.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const candado = vi.hoisted(() => ({ cargado: false }));
vi.mock("server-only", () => {
  candado.cargado = true;
  return {};
});

const CARPETA = path.join(__dirname, "..", "..", "..", "src", "proyecciones");
const DEL_SERVIDOR = ["leer.ts", "proyectar.ts"];
const fuente = (archivo: string) => readFileSync(path.join(CARPETA, archivo), "utf8");
/** Importaciones con valor (no `import type` ni `export type`) de un archivo: import/export … from, import() y require(). */
const IMPORTACION = /^(?:import|export)\s+(?!type\b)(?:[^"';()=]*?from\s+)?["']([^"']+)["']|\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/gm;
const importaciones = (texto: string) => [...texto.matchAll(IMPORTACION)].map((m) => (m[1] ?? m[2])!);
/** Lo único que un módulo puro puede importar con valor fuera de su carpeta: módulos puros ya existentes. La ventana del
 * cruce de los decretos (C5b) es pura (solo fechas; su prueba lo fija): el motor cruza igual que la pantalla. */
const PUROS_DE_AFUERA = new Set(["../plan/tenencia", "../plan/fechas", "../precios/horario", "../datos-oficiales/decretos/ventana"]);

describe("frontera del motor de proyecciones", () => {
  it("leer.ts y proyectar.ts cargan server-only como primera importación", async () => {
    for (const a of DEL_SERVIDOR) expect(importaciones(fuente(a))[0]).toBe("server-only");
    await import("@/proyecciones/leer");
    expect(candado.cargado).toBe(true);
  });

  it("el candado ve también export … from, import() dinámico y require (security-reviewer B5)", () => {
    const muestra = ['export { x } from "@prisma/client";', 'export * from "server-only";', 'const m = await import("node:fs");', 'const r = require("../lib/db");', 'export type { T } from "./solo-tipos";'].join("\n");
    expect(importaciones(muestra)).toEqual(["@prisma/client", "server-only", "node:fs", "../lib/db"]);
  });

  it("los módulos puros solo importan con valor de su carpeta o de módulos puros conocidos", () => {
    const puros = readdirSync(CARPETA).filter((a) => a.endsWith(".ts") && !DEL_SERVIDOR.includes(a));
    expect(puros.length).toBeGreaterThanOrEqual(10);
    for (const a of puros) {
      const fuera = importaciones(fuente(a)).filter((i) => !i.startsWith("./") && !PUROS_DE_AFUERA.has(i));
      expect(fuera, a).toEqual([]);
    }
  });

  it("parámetros inválidos: ok = false sin tocar la base", async () => {
    const { proyectar } = await import("@/proyecciones/proyectar");
    const base = new Proxy({}, { get: () => { throw new Error("tocó la base"); } }) as unknown as PrismaClient;
    const r = await proyectar(base, { horizonteMeses: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toContainEqual({ campo: "horizonteMeses", codigo: "FUERA_DE_RANGO" });
  });

  it("una cantidad que no cabe exacta en un número se rechaza", async () => {
    const { aNumeroExacto } = await import("@/proyecciones/leer");
    expect(aNumeroExacto(1237n)).toBe(1237);
    expect(() => aNumeroExacto(2n ** 53n)).toThrow(RangeError);
    expect(() => aNumeroExacto(-(2n ** 53n))).toThrow(RangeError);
  });
});
