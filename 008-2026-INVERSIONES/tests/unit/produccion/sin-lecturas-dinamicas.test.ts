// Requisito del CEO de PI: la app en producción no lee archivos en tiempo de ejecución. La imagen standalone
// solo trae lo que Next rastrea; un readFile de un .md o .json suelto daría 404 o 500 en el VPS (le pasó
// a PI, I-351). Se recorre el grafo de imports desde src/app y se falla si algún módulo usa el sistema de archivos.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const SRC = ruta008("src");
const FS = /from\s+["'](?:node:)?fs(?:\/promises)?["']|require\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\)|process\.cwd\(\)|__dirname|import\.meta\.url/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

function resolver(desde: string, especificador: string): string | null {
  const base = especificador.startsWith("@/") ? path.join(SRC, especificador.slice(2)) : especificador.startsWith(".") ? path.resolve(path.dirname(desde), especificador) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Módulos de src/ alcanzables desde src/app (lo que corre en el servidor de producción). */
function alcanzables(): Set<string> {
  const vistos = new Set<string>();
  const pendientes = archivos(path.join(SRC, "app"));
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    const codigo = readFileSync(actual, "utf8");
    for (const m of codigo.matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const destino = resolver(actual, (m[1] ?? m[2])!);
      if (destino) pendientes.push(destino);
    }
  }
  return vistos;
}

describe("la app no lee archivos en tiempo de ejecución", () => {
  const modulos = alcanzables();

  it("recorre el grafo desde src/app (control: encuentra la ruta de salud y el cliente de la base)", () => {
    expect([...modulos].some((m) => m.endsWith(path.join("api", "salud", "route.ts")))).toBe(true);
    expect([...modulos].some((m) => m.endsWith(path.join("lib", "db.ts")))).toBe(true);
  });

  it("ningún módulo alcanzable usa fs, process.cwd(), __dirname ni import.meta.url", () => {
    const culpables = [...modulos].filter((m) => FS.test(readFileSync(m, "utf8"))).map((m) => path.relative(SRC, m));
    expect(culpables).toEqual([]);
  });

  it("control positivo: el detector reconoce una lectura de archivo", () => {
    expect(FS.test('import { readFileSync } from "node:fs";')).toBe(true);
    expect(FS.test('const r = await import("fs/promises")')).toBe(false);
    expect(FS.test('import fs from "fs/promises";')).toBe(true);
    expect(FS.test("path.join(process.cwd(), 'docs')")).toBe(true);
  });
});
