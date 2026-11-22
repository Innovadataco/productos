// Candado: los lectores acotados de XML y de zip (src/lib/xml-acotado.ts y src/lib/zip-acotado.ts) son SOLO para los
// exportadores del Mac (scripts/exportar-*.ts). Ni la app (src/app/**, más proxy.ts e instrumentation.ts, que también
// corren en el servidor de Next) ni ningún otro script (los importadores, el servicio de precios y los demás, que corren
// en producción o tocan la base) los alcanzan, ni directa ni transitivamente. Se recorre el grafo de imports (los
// especificadores los saca el analizador de TypeScript, que ve todas las formas: import, export … from, import "x",
// import() y require()); un import local que no resuelve o un import()/require() con argumento no literal también
// ponen el candado en rojo (el recorrido no puede saber adónde van).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..");
const LECTORES = ["xml-acotado", "zip-acotado"] as const;
const CODIGO = /\.(ts|tsx|mts|mjs|js)$/;

interface Recorrido {
  readonly modulos: ReadonlySet<string>;
  /** Imports locales que no resolvieron y import()/require() con argumento no literal, con su módulo. */
  readonly problemas: readonly string[];
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : CODIGO.test(n) ? [p] : [];
  });
}

/** Especificadores de un módulo (por el analizador de TypeScript) y cuántos import()/require() no llevan un literal. */
function especificadores(codigo: string): { literales: string[]; dinamicosSinLiteral: number } {
  void ts;
  const literales = [
    ...codigo.matchAll(/(?:^|[^\w$.])(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g),
    ...codigo.matchAll(/(?:^|[^\w$.])import\s*["']([^"']+)["']/g),
    ...codigo.matchAll(/(?:^|[^\w$.])(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]!);
  const dinamicos = [...codigo.matchAll(/(?:^|[^\w$.])(?:import|require)\s*\(\s*([^\s)])/g)].filter((m) => !["'", '"'].includes(m[1]!)).length;
  return { literales, dinamicosSinLiteral: dinamicos };
}

function resolver(src: string, desde: string, especificador: string): string | null | "externo" {
  const base = especificador.startsWith("@/") ? path.join(src, especificador.slice(2)) : especificador.startsWith(".") ? path.resolve(path.dirname(desde), especificador) : null;
  if (base === null) return "externo";
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Módulos alcanzables desde `inicios` (con `src` como destino de `@/`). */
function recorrer(src: string, inicios: readonly string[]): Recorrido {
  const modulos = new Set<string>();
  const problemas: string[] = [];
  const pendientes = [...inicios];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (modulos.has(actual)) continue;
    modulos.add(actual);
    if (!CODIGO.test(actual)) continue;
    const { literales, dinamicosSinLiteral } = especificadores(readFileSync(actual, "utf8"));
    if (dinamicosSinLiteral > 0) problemas.push(`${actual}: import()/require() sin literal`);
    for (const e of literales) {
      const destino = resolver(src, actual, e);
      if (destino === "externo") continue;
      if (destino === null) problemas.push(`${actual}: no resuelve ${e}`);
      else pendientes.push(destino);
    }
  }
  return { modulos, problemas };
}

const esLector = (m: string) => LECTORES.some((l) => path.basename(m).replace(CODIGO, "") === l);

describe("candado: la app y los scripts (salvo los exportadores) no alcanzan los lectores de XML ni de zip", () => {
  const SRC = path.join(RAIZ, "src");
  const scripts = archivos(path.join(RAIZ, "scripts")).filter((p) => !/^exportar-/.test(path.basename(p)));
  const app = [...archivos(path.join(SRC, "app")), path.join(SRC, "proxy.ts"), path.join(SRC, "instrumentation.ts")];

  it("los dos lectores existen donde el candado los busca", () => {
    for (const l of LECTORES) expect(existsSync(path.join(SRC, "lib", `${l}.ts`))).toBe(true);
  });

  it("desde la app: recorre el grafo (control: llega a la ruta de salud y al cliente de la base) y no llega a los lectores", () => {
    const { modulos, problemas } = recorrer(SRC, app);
    expect([...modulos].some((m) => m.endsWith(path.join("api", "salud", "route.ts")))).toBe(true);
    expect([...modulos].some((m) => m.endsWith(path.join("lib", "db.ts")))).toBe(true);
    expect(problemas).toEqual([]);
    expect([...modulos].filter(esLector).map((m) => path.relative(RAIZ, m))).toEqual([]);
  });

  it("las raíces de scripts son todos menos scripts/exportar-*: los importadores, el servicio de precios y los demás", () => {
    const nombres = scripts.map((p) => path.relative(path.join(RAIZ, "scripts"), p));
    expect(nombres.filter((n) => n.startsWith("importar-")).length).toBeGreaterThanOrEqual(5);
    expect(nombres).toEqual(expect.arrayContaining(["servicio-precios.ts", "actualizar-precios.ts", "actualizar-fondo.ts", "conciliar-certificacion.ts"]));
    expect(nombres.filter((n) => n.startsWith("exportar-"))).toEqual([]);
  });

  it("desde los scripts: recorre el grafo (control: importar-precios llega a lib/archivo-acotado.ts) y no llega a los lectores", () => {
    const { modulos, problemas } = recorrer(SRC, scripts);
    expect([...modulos].some((m) => m.endsWith(path.join("lib", "archivo-acotado.ts")))).toBe(true);
    expect(problemas).toEqual([]);
    expect([...modulos].filter(esLector).map((m) => path.relative(RAIZ, m))).toEqual([]);
  });

  it("los lectores no importan nada salvo node:zlib (el de zip): ni fs, ni red, ni procesos", () => {
    const xml = especificadores(readFileSync(path.join(SRC, "lib", "xml-acotado.ts"), "utf8"));
    const zip = especificadores(readFileSync(path.join(SRC, "lib", "zip-acotado.ts"), "utf8"));
    expect(xml).toEqual({ literales: [], dinamicosSinLiteral: 0 });
    expect(zip).toEqual({ literales: ["node:zlib"], dinamicosSinLiteral: 0 });
  });
});

describe("candado: control positivo sobre un grafo armado a mano", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inv008-candado-lectores-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const src = path.join(dir, "src");
  mkdirSync(path.join(src, "lib"), { recursive: true });
  mkdirSync(path.join(src, "app"), { recursive: true });
  writeFileSync(path.join(src, "lib", "xml-acotado.ts"), "export const x = 1;\n");
  writeFileSync(path.join(src, "lib", "zip-acotado.ts"), "export const z = 1;\n");
  const caso = (nombre: string, codigo: string) => {
    const p = path.join(src, "app", `${nombre}.ts`);
    writeFileSync(p, codigo);
    return recorrer(src, [p]);
  };
  const alcanza = (r: Recorrido) => [...r.modulos].some(esLector);

  it.each([
    ["import con nombres", 'import { x } from "@/lib/xml-acotado";'],
    ["import pegado, sin espacios", 'import{x}from"@/lib/xml-acotado";'],
    ["export * pegado, sin espacios", 'export*from"../lib/zip-acotado";'],
    ["import de tipos en varias líneas", 'import type {\n  x,\n} from "../lib/zip-acotado";'],
    ["import sin cláusula", 'import "@/lib/xml-acotado";'],
    ["export * from", 'export * from "../lib/zip-acotado";'],
    ["export con nombres", 'export { z } from "@/lib/zip-acotado";'],
    ["import() con literal", 'const m = await import("@/lib/xml-acotado");'],
    ["require()", 'const m = require("../lib/zip-acotado");'],
  ])("detecta %s", (_caso, codigo) => {
    expect(alcanza(caso(_caso.replace(/\W+/g, "-"), codigo))).toBe(true);
  });

  it("detecta el camino transitivo (app → intermedio → lector)", () => {
    writeFileSync(path.join(src, "lib", "intermedio.ts"), 'export * from "./xml-acotado";\n');
    expect(alcanza(caso("transitivo", 'import { x } from "@/lib/intermedio";'))).toBe(true);
  });

  it("un import local que no resuelve y un import() sin literal quedan como problema", () => {
    expect(caso("roto", 'import { y } from "@/lib/no-existe";').problemas).toHaveLength(1);
    expect(caso("dinamico", 'const n = "x"; const m = await import(n);').problemas).toHaveLength(1);
    expect(caso("plantilla", "const m = await import(`@/lib/${'xml-acotado'}`);").problemas).toHaveLength(1);
  });

  it("un módulo que no los importa no los alcanza (y los paquetes externos no cuentan)", () => {
    const r = caso("limpio", 'import { readFileSync } from "node:fs";\nimport x from "next/server";\nconst importar = 1; // import("x")\n');
    expect(alcanza(r)).toBe(false);
    expect(r.problemas).toEqual([]);
  });
});
