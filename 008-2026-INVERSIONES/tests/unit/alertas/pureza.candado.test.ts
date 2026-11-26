import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Candado: el motor de alertas es puro. Sin base, red, reloj ni azar; todo entra por parámetro.
const RAIZ = join(__dirname, "..", "..", "..", "src", "alertas");

const SRC = join(RAIZ, "..");

/** Lo único que el motor puede importar de fuera de src/alertas (rutas desde src/), además de @prisma/client. */
const IMPORTABLES_DE_SRC: readonly string[] = ["plan/niveles", "plan/tenencia", "plan/fechas", "precios/horario", "datos-oficiales/decretos/proximos"];

const PROHIBIDO: ReadonlyArray<readonly [string, RegExp]> = [
  ["reloj: Date.now", /\bDate\s*(\.\s*now\b|\[\s*["'`]now["'`]\s*\])/],
  ["reloj: new Date sin argumento", /new\s+Date\b(?!\s*\(\s*[^)\s])/],
  ["reloj: Date() como función", /(?<![\w$.])(?<!new\s+)Date\s*\(/],
  ["reloj: performance", /\bperformance\b/],
  ["temporizador", /\b(setTimeout|setInterval|setImmediate)\b/],
  ["azar", /\bMath\s*(\.\s*random\b|\[\s*["'`]random["'`]\s*\])|\brandomUUID\b|\bgetRandomValues\b/],
  ["red", /\bfetch\b|\bXMLHttpRequest\b|\bWebSocket\b/],
  ["entorno global", /\b(process|globalThis|window|self|global)\b/],
  ["base", /\bPrismaClient\b|\$queryRaw|\$executeRaw|\bTransactionClient\b/],
  ["servidor", /server-only/],
  ["import() dinámico o require()", /\bimport\s*\(|\brequire\s*\(/],
  ["importa @prisma/client algo que no sea Prisma o tipos", /import\s+(?!type\b)\{(?![^}]*\bPrisma\b[^}]*\})[^}]*\}\s+from\s+["']@prisma\/client["']/],
];

/**
 * Quita los comentarios con un pequeño escáner que respeta los strings: un `//` dentro de "http://x" no esconde lo que sigue.
 * Los strings se dejan (los necesitan los imports). No entiende literales de regex: basta para código de 008, y falla del lado seguro
 * (ve de más, no de menos).
 */
export function sinComentarios(t: string): string {
  let salida = "";
  let i = 0;
  while (i < t.length) {
    const c = t[i]!;
    const d = t[i + 1];
    if (c === "/" && d === "/") { while (i < t.length && t[i] !== "\n") i += 1; continue; }
    if (c === "/" && d === "*") { const fin = t.indexOf("*/", i + 2); i = fin < 0 ? t.length : fin + 2; salida += " "; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < t.length && t[j] !== c) j += t[j] === "\\" ? 2 : 1;
      salida += t.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    salida += c;
    i += 1;
  }
  return salida;
}

const IMPORTES = /\b(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;

/** Los módulos que el archivo importa y que no están en la lista permitida. Todo lo demás (node:*, pg, alias, rutas que salen de alertas) sobra. */
export function importacionesNoPermitidas(limpio: string, ruta: string): string[] {
  const malas: string[] = [];
  for (const m of limpio.matchAll(IMPORTES)) {
    const spec = (m[1] ?? m[2])!;
    if (spec === "@prisma/client") continue;
    const destino = spec.startsWith(".") ? resolve(dirname(ruta), spec) : null;
    const permitido = destino !== null && (destino.startsWith(RAIZ + sep) || IMPORTABLES_DE_SRC.some((r) => destino === join(SRC, r)));
    if (!permitido) malas.push(spec);
  }
  return malas;
}

export function violaciones(codigo: string, ruta: string = join(RAIZ, "x.ts")): string[] {
  const limpio = sinComentarios(codigo);
  const familias = PROHIBIDO.filter(([, re]) => re.test(limpio)).map(([nombre]) => nombre);
  return importacionesNoPermitidas(limpio, ruta).length > 0 ? [...familias, "importa un módulo que no está permitido"] : familias;
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith(".ts") ? [ruta] : [];
  });
}

/**
 * Los únicos archivos de src/alertas que tocan la base: leen la entrada y guardan lo que el motor detectó (PR-B). Todo lo demás
 * es el motor y sigue puro. Ningún archivo puro puede importarlos (el motor no llega a la base ni por un atajo).
 */
export const ENTRADA_SALIDA = ["leer-entrada.ts", "guardar.ts", "correr.ts", "credencial.ts"] as const;

/** Los de entrada y salida tocan la base, pero nada más: ni reloj, ni azar, ni red, ni entorno, ni disco (el reloj y la configuración entran por parámetro). */
export const violacionesDeEntradaSalida = (codigo: string): string[] => {
  const familias = violaciones(codigo).filter((v) => v !== "base" && v !== "importa un módulo que no está permitido");
  // Disco y paquetes: solo se importa @prisma/client y rutas propias (relativas); nada de node:*, fs, pg ni un alias que llegue a otro lado.
  const ajenos = [...sinComentarios(codigo).matchAll(IMPORTES)].map((m) => (m[1] ?? m[2])!).filter((e) => e !== "@prisma/client" && !e.startsWith("."));
  return ajenos.length > 0 ? [...familias, "disco o paquete ajeno"] : familias;
};
const IMPORTA_ENTRADA_SALIDA = /from\s+["'](?:(?:\.\.?\/)+|@\/alertas\/)(leer-entrada|guardar|correr|credencial)["']/;

describe("pureza del motor de alertas", () => {
  const todos = archivos(RAIZ);
  const fuentes = todos.filter((r) => !ENTRADA_SALIDA.some((e) => r === join(RAIZ, e)));

  it("la excepción es exactamente la lista de entrada y salida, y esos archivos existen", () => {
    expect(todos.filter((r) => !fuentes.includes(r)).map((r) => r.slice(RAIZ.length + 1)).sort()).toEqual([...ENTRADA_SALIDA].sort());
  });

  it("ningún archivo puro importa los de entrada y salida", () => {
    for (const ruta of fuentes) {
      const codigo = sinComentarios(readFileSync(ruta, "utf8"));
      expect(codigo, ruta).not.toMatch(IMPORTA_ENTRADA_SALIDA);
    }
  });

  it("los de entrada y salida siguen con el candado de reloj, azar, red, entorno y disco (solo se les permite la base)", () => {
    for (const e of ENTRADA_SALIDA) expect(violacionesDeEntradaSalida(readFileSync(join(RAIZ, e), "utf8")), e).toEqual([]);
  });

  it("control positivo: el candado de entrada y salida muerde cada familia menos la base, y el detector del alias ve la importación", () => {
    expect(violacionesDeEntradaSalida("const a = Date.now();")).toContain("reloj: Date.now");
    expect(violacionesDeEntradaSalida("const a = process.env.X;")).toContain("entorno global");
    expect(violacionesDeEntradaSalida("await fetch(url)")).toContain("red");
    expect(violacionesDeEntradaSalida('import { readFileSync } from "node:fs";')).toContain("disco o paquete ajeno");
    expect(violacionesDeEntradaSalida('import { Pool } from "pg";')).toContain("disco o paquete ajeno");
    expect(violacionesDeEntradaSalida('import { fechaEnBogota } from "../precios/horario";')).toEqual([]);
    expect(violacionesDeEntradaSalida("const db = new PrismaClient(); db.$queryRaw`x`")).toEqual([]);
    for (const malo of ['import { x } from "@/alertas/leer-entrada";', 'import { x } from "../guardar";', 'import { x } from "./correr";', 'import { x } from "@/alertas/credencial";']) {
      expect(IMPORTA_ENTRADA_SALIDA.test(malo), malo).toBe(true);
    }
    expect(IMPORTA_ENTRADA_SALIDA.test('import { x } from "@/alertas/umbrales";')).toBe(false);
  });

  it("control positivo: los de entrada y salida sí tocan la base (si no, la excepción sobra)", () => {
    for (const e of ENTRADA_SALIDA) expect(violaciones(readFileSync(join(RAIZ, e), "utf8")), e).toContain("base");
  });

  it("hay archivos que revisar", () => {
    expect(fuentes.length).toBeGreaterThanOrEqual(8);
  });

  it.each(fuentes.map((r) => [r.slice(RAIZ.length + 1), r]))("%s no usa base, red, reloj ni azar", (_n, ruta) => {
    expect(violaciones(readFileSync(ruta as string, "utf8"), ruta as string)).toEqual([]);
  });

  it("control positivo: el detector muerde cada familia", () => {
    const malos: Record<string, string> = {
      "reloj: Date.now": "const a = Date.now();",
      "reloj: new Date sin argumento": "const a = new Date();",
      "reloj: performance": "performance.now()",
      temporizador: "setTimeout(() => 1, 5)",
      azar: "Math.random()",
      red: "await fetch(url)",
      "entorno global": "process.env.X",
      base: "const db = new PrismaClient();",
      servidor: 'import "server-only";',
      "importa un módulo que no está permitido": 'import { readFileSync } from "node:fs";',
      "importa @prisma/client algo que no sea Prisma o tipos": 'import { PrismaClient as P } from "@prisma/client";',
    };
    for (const [nombre, codigo] of Object.entries(malos)) expect(violaciones(codigo), nombre).toContain(nombre);
  });

  // Evasiones conocidas: cada una debe morder, aunque no esté en la lista de las familias simples.
  const EVASIONES: ReadonlyArray<readonly [string, string]> = [
    ["import() dinámico", 'const m = await import("node:fs");'],
    ["require()", 'const fs = require("fs");'],
    ["node:fs/promises", 'import { readFile } from "node:fs/promises";'],
    ["node:os", 'import os from "node:os";'],
    ["node:http2", 'import h from "node:http2";'],
    ["pg", 'import { Pool } from "pg";'],
    ["alias @/", 'import { db } from "@/lib/db";'],
    ["ruta relativa que sale de src/alertas", 'import { db } from "../../lib/db";'],
    ["new Date sin paréntesis", "const a = new Date;"],
    ["Date() como función", "const a = Date();"],
    ["// dentro de un string no esconde lo que sigue", 'const u = "http://x"; const n = Date.now();'],
    ["globalThis.fetch", "const f = globalThis.fetch;"],
    ["Date['now']", 'const t = Date["now"]();'],
    ["process importado", 'import p from "process";'],
    ["Math['random']", 'const r = Math["random"]();'],
  ];
  it.each(EVASIONES)("evasión: %s", (_n, codigo) => {
    expect(violaciones(codigo, join(RAIZ, "evaluar", "x.ts")).length).toBeGreaterThan(0);
  });
  it("control negativo: lo permitido pasa y los comentarios no acusan", () => {
    const ruta = join(RAIZ, "evaluar", "x.ts");
    expect(violaciones('import { Prisma } from "@prisma/client";\nimport type { Prisma as P } from "@prisma/client";\nconst d = new Date(x);', ruta)).toEqual([]);
    expect(violaciones('import { estadoDelNivel } from "../../plan/niveles";\nimport type { Alerta } from "../tipos";\nconst u = "http://x"; // Date.now()', ruta)).toEqual([]);
    expect(violaciones("// no usa Date.now ni fetch(\n/* Math.random */ const a = 1;")).toEqual([]);
  });
});
