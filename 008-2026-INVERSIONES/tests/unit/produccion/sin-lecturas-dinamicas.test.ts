// Requisito del CEO de PI: la app en producción no lee archivos en tiempo de ejecución. La imagen standalone
// solo trae lo que Next rastrea; un readFile de un .md o .json suelto daría 404 o 500 en el VPS (le pasó
// a PI, I-351). Se recorre el grafo de imports desde src/app y se falla si algún módulo usa el sistema de archivos.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const SRC = ruta008("src");
// Excepciones explícitas, con su razón. Nada más puede leer archivos.
const PERMITIDOS: Record<string, string> = {
  // Lee AUTH_SECRET_FILE solo si se define. El compose de producción pasa AUTH_SECRET (variable) y nunca
  // define AUTH_SECRET_FILE: compose-prod.test.ts fija las variables exactas de la app.
  [path.join("auth", "secreto.ts")]: "AUTH_SECRET_FILE",
  // E8 (por aprobar: fuera de la zona del frente): la lista de modelos que publica PI. Lee SOLO
  // <INV_IA_DIR_COMPARTIDA>/modelos-ia-local-permitidos.json, por ruta ABSOLUTA del entorno (un directorio montado de
  // solo lectura, fuera de la imagen: no es un archivo que Next deba rastrear) y con fallo blando: sin la variable o sin
  // el archivo no hay 404 ni 500 (lo de I-351); la puerta local queda «sin lista de PI».
  [path.join("ia", "local", "modelos.ts")]: "INV_IA_DIR_COMPARTIDA",
};
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
    expect(culpables.filter((m) => !(m in PERMITIDOS))).toEqual([]);
  });

  it("la excepción de ia/local/modelos.ts lee solo el archivo de PI, por la variable y con fallo blando", () => {
    const codigo = readFileSync(path.join(SRC, "ia", "local", "modelos.ts"), "utf8");
    expect(codigo).toMatch(/VARIABLE_DIR_COMPARTIDA = "INV_IA_DIR_COMPARTIDA"/);
    expect(codigo).toMatch(/ARCHIVO_LISTA_PI = "modelos-ia-local-permitidos\.json"/);
    expect(codigo).not.toMatch(/process\.cwd\(\)|__dirname|import\.meta\.url/);
    expect([...codigo.matchAll(/\b(?:readFileSync|openSync|readdirSync|readFile)\(/g)]).toHaveLength(2);
  });

  it("la excepción de auth/secreto.ts solo se usa con AUTH_SECRET_FILE, que producción nunca define", () => {
    const codigo = readFileSync(path.join(SRC, "auth", "secreto.ts"), "utf8");
    expect(codigo).toMatch(/AUTH_SECRET_FILE/);
    const compose = readFileSync(ruta008("docker-compose.prod.yml"), "utf8");
    expect(compose).not.toMatch(/AUTH_SECRET_FILE/);
  });

  it("control positivo: el detector reconoce una lectura de archivo", () => {
    expect(FS.test('import { readFileSync } from "node:fs";')).toBe(true);
    expect(FS.test('const r = await import("fs/promises")')).toBe(false);
    expect(FS.test('import fs from "fs/promises";')).toBe(true);
    expect(FS.test("path.join(process.cwd(), 'docs')")).toBe(true);
  });
});
