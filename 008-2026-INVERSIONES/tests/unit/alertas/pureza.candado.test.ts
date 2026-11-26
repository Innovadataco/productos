import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Candado: el motor de alertas es puro. Sin base, red, reloj ni azar; todo entra por parámetro.
const RAIZ = join(__dirname, "..", "..", "..", "src", "alertas");

const PROHIBIDO: ReadonlyArray<readonly [string, RegExp]> = [
  ["reloj: Date.now", /\bDate\s*\.\s*now\b/],
  ["reloj: new Date()", /new\s+Date\s*\(\s*\)/],
  ["reloj: performance", /\bperformance\s*\./],
  ["temporizador", /\b(setTimeout|setInterval|setImmediate)\b/],
  ["azar", /\bMath\s*\.\s*random\b|\brandomUUID\b|\bgetRandomValues\b/],
  ["red", /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|from\s+["'](node:)?(http|https|net|dns|tls)["']/],
  ["entorno", /\bprocess\s*\.\s*(env|hrtime|uptime)\b/],
  ["base", /\bPrismaClient\b|\$queryRaw|\$executeRaw|\bTransactionClient\b|from\s+["'](\.\.?\/)+(lib\/db|db)["']|from\s+["']@\/lib\/db/],
  ["servidor", /server-only/],
  ["disco", /from\s+["'](node:)?(fs|child_process|crypto)["']/],
  ["importa @prisma/client algo que no sea Prisma o tipos", /import\s+(?!type\b)\{(?![^}]*\bPrisma\b[^}]*\})[^}]*\}\s+from\s+["']@prisma\/client["']/],
];

/** Quita comentarios para no acusar al texto que explica la regla. */
const sinComentarios = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

export function violaciones(codigo: string): string[] {
  const limpio = sinComentarios(codigo);
  return PROHIBIDO.filter(([, re]) => re.test(limpio)).map(([nombre]) => nombre);
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
    expect(violaciones(readFileSync(ruta as string, "utf8"))).toEqual([]);
  });

  it("control positivo: el detector muerde cada familia", () => {
    const malos: Record<string, string> = {
      "reloj: Date.now": "const a = Date.now();",
      "reloj: new Date()": "const a = new Date();",
      "reloj: performance": "performance.now()",
      temporizador: "setTimeout(() => 1, 5)",
      azar: "Math.random()",
      red: "await fetch(url)",
      entorno: "process.env.X",
      base: "const db = new PrismaClient();",
      servidor: 'import "server-only";',
      disco: 'import { readFileSync } from "node:fs";',
      "importa @prisma/client algo que no sea Prisma o tipos": 'import { PrismaClient as P } from "@prisma/client";',
    };
    for (const [nombre, codigo] of Object.entries(malos)) expect(violaciones(codigo), nombre).toContain(nombre);
  });

  it("control negativo: lo permitido pasa y los comentarios no acusan", () => {
    expect(violaciones('import { Prisma } from "@prisma/client";\nimport type { Prisma as P } from "@prisma/client";\nconst d = new Date(x);')).toEqual([]);
    expect(violaciones("// no usa Date.now ni fetch(\n/* Math.random */ const a = 1;")).toEqual([]);
  });
});
