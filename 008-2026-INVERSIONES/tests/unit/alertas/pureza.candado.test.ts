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

describe("pureza del motor de alertas", () => {
  const fuentes = archivos(RAIZ);

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
