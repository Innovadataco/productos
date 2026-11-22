/**
 * Candado de pureza del simulador (src/operar/simulador): sin base, sin red, sin reloj, sin azar y sin punto
 * flotante para el dinero. Lo revisa el analizador de TypeScript (no una regex: los comentarios no cuentan):
 * - imports en lista blanca: `@prisma/client` (como valor solo `Prisma`; lo demás, solo tipos), `@/plan/niveles`,
 *   `@/plan/edicion/formato` y los relativos que se quedan en la carpeta (`./x`, no `./../x`); ni `import()`, ni
 *   `import x = require(…)`, ni `require`;
 * - identificadores prohibidos fuera de los tipos: Date (salvo a la derecha de `instanceof`), Math, Number, Intl,
 *   parseFloat, parseInt, fetch, process, global, globalThis, self, console, temporizadores, crypto, performance,
 *   eval, Function, Reflect, Buffer, structuredClone, Temporal, PrismaClient…;
 * - `.toNumber()` o `["toNumber"]` sobre un Decimal, el `+` unario (pasa a number) y los literales con decimales.
 * Las dos dependencias permitidas también tienen que ser puras. Con control positivo: cada prohibición muerde.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = path.join(__dirname, "..", "..", "..", "..", "src");
const ZONA = path.join(SRC, "operar", "simulador");
const DEPENDENCIAS = { "@/plan/niveles": path.join(SRC, "plan", "niveles.ts"), "@/plan/edicion/formato": path.join(SRC, "plan", "edicion", "formato.ts") };
const PERMITIDOS = new Set(["@prisma/client", ...Object.keys(DEPENDENCIAS)]);
const IDENTIFICADORES = new Set([
  "Date", "Math", "Number", "Intl", "parseFloat", "parseInt", "fetch", "process", "global", "globalThis", "self", "window", "require",
  "console", "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "crypto", "performance", "eval", "Function", "Reflect",
  "Buffer", "structuredClone", "Temporal", "Atomics", "SharedArrayBuffer", "XMLHttpRequest", "WebSocket", "PrismaClient",
]);

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

const enTipo = (n: ts.Node): boolean => {
  for (let p: ts.Node | undefined = n.parent; p !== undefined; p = p.parent) if (ts.isTypeNode(p)) return true;
  return false;
};

/** `x.Date` o `{ Date: … }`: es un nombre de propiedad, no el global. */
const esNombreDePropiedad = (n: ts.Identifier): boolean =>
  (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) || ((ts.isPropertyAssignment(n.parent) || ts.isPropertySignature(n.parent)) && n.parent.name === n);

const aLaDerechaDeInstanceof = (n: ts.Identifier): boolean =>
  ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && n.parent.right === n;

/** Relativo que se queda en la carpeta: empieza por «./» y, normalizado, no sube. */
const relativoDeLaCarpeta = (modulo: string): boolean => modulo.startsWith("./") && !path.posix.normalize(modulo).startsWith("..");

function revisarImport(d: ts.ImportDeclaration | ts.ExportDeclaration): string[] {
  const modulo = d.moduleSpecifier && ts.isStringLiteral(d.moduleSpecifier) ? d.moduleSpecifier.text : null;
  if (modulo === null) return [];
  if (!relativoDeLaCarpeta(modulo) && !PERMITIDOS.has(modulo)) return [`import ${modulo}`];
  if (modulo !== "@prisma/client" || !ts.isImportDeclaration(d) || d.importClause === undefined || d.importClause.isTypeOnly) return [];
  const clausula = d.importClause;
  const nombres = clausula.namedBindings;
  if (clausula.name !== undefined || nombres === undefined || ts.isNamespaceImport(nombres)) return ["import @prisma/client completo"];
  return nombres.elements.filter((e) => !e.isTypeOnly && e.name.text !== "Prisma").map((e) => `valor ${e.name.text} de @prisma/client`);
}

const esLiteralConDecimales = (n: ts.Node): boolean => ts.isNumericLiteral(n) && /^\d[\d_]*(\.|[eE])/.test(n.getText());

function hallazgosDelNodo(n: ts.Node): string[] {
  if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return revisarImport(n);
  if (ts.isImportEqualsDeclaration(n)) return ["import = require"];
  if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) return ["import()"];
  if (ts.isPropertyAccessExpression(n) && n.name.text === "toNumber") return ["toNumber"];
  if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === "toNumber") return ["toNumber"];
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.PlusToken) return ["+ unario"];
  if (esLiteralConDecimales(n)) return ["literal con decimales"];
  if (ts.isIdentifier(n) && IDENTIFICADORES.has(n.text) && !enTipo(n) && !esNombreDePropiedad(n) && !(n.text === "Date" && aLaDerechaDeInstanceof(n))) return [n.text];
  return [];
}

function hallazgos(codigo: string): string[] {
  const fuente = ts.createSourceFile("x.ts", codigo, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const hallados: string[] = [];
  const visitar = (n: ts.Node): void => {
    hallados.push(...hallazgosDelNodo(n));
    ts.forEachChild(n, visitar);
  };
  visitar(fuente);
  return hallados;
}

describe("candado de pureza del simulador", () => {
  it("control positivo: cada prohibición muerde", () => {
    const casos: readonly (readonly [string, string])[] = [
      ['import { PrismaClient } from "@prisma/client";', "valor PrismaClient de @prisma/client"],
      ['import * as todo from "@prisma/client";', "import @prisma/client completo"],
      ['import { prisma } from "@/lib/db";', "import @/lib/db"],
      ['import { leerReglas } from "../../plan/lectura";', "import ../../plan/lectura"],
      ['import { prisma } from "./../../lib/db";', "import ./../../lib/db"],
      ['export { x } from "node:fs";', "import node:fs"],
      ['import fs = require("node:fs");', "import = require"],
      ["const m = await import('./simular');", "import()"],
      ["const hoy = new Date();", "Date"],
      ["const t = Date.now();", "Date"],
      ["const t = global.Date.now();", "global"],
      ["const r = Math.random();", "Math"],
      ["const v = Number(precio);", "Number"],
      ["const v = precio.toNumber();", "toNumber"],
      ['const v = precio["toNumber"]();', "toNumber"],
      ["const v = +texto;", "+ unario"],
      ["const v = precio * 1.5;", "literal con decimales"],
      ["const v = 1e-7;", "literal con decimales"],
      ["const v = parseFloat(texto);", "parseFloat"],
      ["await fetch(url);", "fetch"],
      ["const k = process.env.CLAVE;", "process"],
      ["console.log(x);", "console"],
      ["setTimeout(f, 1237);", "setTimeout"],
      ["const f = new Intl.NumberFormat();", "Intl"],
      ["const g = globalThis;", "globalThis"],
      ["const c = structuredClone(x);", "structuredClone"],
      ["const b = Buffer.from(x);", "Buffer"],
      ["const r = Reflect.get(o, k);", "Reflect"],
    ];
    for (const [codigo, esperado] of casos) expect(hallazgos(codigo), codigo).toContain(esperado);
  });

  it("control negativo: tipos, nombres de propiedad, instanceof Date, enteros, resta e imports permitidos no muerden", () => {
    const limpio = [
      'import { Prisma, type AccionPlan } from "@prisma/client";',
      'import type { LadoOrden } from "@prisma/client";',
      'import { estadoDelNivel } from "@/plan/niveles";',
      'import { cantidadEs } from "@/plan/edicion/formato";',
      'import type { ReglaSimulada } from "./tipos";',
      'import { simular } from "./sub/simular";',
      "interface X { readonly hoy: Date; readonly n: number }",
      "const ok = (v: unknown): v is Date => v instanceof Date;",
      "const o = { Date: 1 }; const p = o.Date;",
      "const ms = 86_400_000; const d = -cantidad; const b = 10n ** 13n;",
      "// Date.now() y Math.random() en un comentario no cuentan",
    ].join("\n");
    expect(hallazgos(limpio)).toEqual([]);
  });

  it("el fuente del simulador es puro", () => {
    const fuentes = archivos(ZONA);
    expect(fuentes.length).toBeGreaterThan(5);
    const infractores = fuentes.flatMap((p) => hallazgos(readFileSync(p, "utf8")).map((h) => `${path.basename(p)}: ${h}`));
    expect(infractores).toEqual([]);
  });

  it("las dos dependencias permitidas también son puras", () => {
    const infractores = Object.entries(DEPENDENCIAS).flatMap(([modulo, p]) => hallazgos(readFileSync(p, "utf8")).map((h) => `${modulo}: ${h}`));
    expect(infractores).toEqual([]);
  });
});
