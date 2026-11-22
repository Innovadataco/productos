/**
 * Candado de pureza de los armadores y de `presentar` (src/ia/hechos/** y src/ia/presentar.ts): sin base, sin red, sin
 * reloj y sin azar. El analizador de TypeScript revisa cada archivo:
 * - ningún import de ejecución de la base, del sistema de archivos, de la red, de los clientes de las puertas ni de
 *   `server-only` (los `import type` se permiten: se borran al compilar);
 * - ni `Date.now()`, ni `new Date()` sin argumentos, ni `Math.random()`, ni `fetch`, ni `process.env`;
 * - ninguna lectura de los campos que nunca entran al paquete (acción, cantidad, tenencia, texto libre, encargo,
 *   cuenta, unidades, referencia oficial, textos de los avisos).
 * Con control positivo: cada detector muerde un fragmento que lo viola.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const CARPETA = path.join(RAIZ, "src", "ia", "hechos");
const PRESENTAR = path.join(RAIZ, "src", "ia", "presentar.ts");

const MODULOS_PROHIBIDOS: readonly RegExp[] = [
  /^server-only$/, /^@prisma\/client$/, /(^|\/)lib\/db(\.ts)?$/, /^(node:)?(fs|net|http|https|http2|child_process|dgram|tls|dns|worker_threads)(\/|$)/,
  /http-acotado/, /precios\/yahoo/, /fondo\/sfc/, /^@anthropic-ai\//,
  // Los clientes de las puertas y el generador: los armadores no llaman a ningún modelo.
  /(^|\/)(local|nube)(\/|$)/, /(^|\/)(puertas|generador|generador-falso)(\.ts)?$/,
];
const CAMPOS_PROHIBIDOS: ReadonlySet<string> = new Set([
  "accion", "cantidad", "tenencia", "detalle", "encargo", "cuenta", "unidades", "referenciaOficial", "textos", "texto", "correo", "email",
]);

/** Los módulos que el código importa EN EJECUCIÓN (sin los `import type` ni los `export type`). */
function importsDeEjecucion(fuente: ts.SourceFile): string[] {
  const hallados: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (ts.isImportDeclaration(nodo) && ts.isStringLiteral(nodo.moduleSpecifier) && !nodo.importClause?.isTypeOnly) hallados.push(nodo.moduleSpecifier.text);
    if (ts.isExportDeclaration(nodo) && nodo.moduleSpecifier && ts.isStringLiteral(nodo.moduleSpecifier) && !nodo.isTypeOnly) hallados.push(nodo.moduleSpecifier.text);
    if (ts.isCallExpression(nodo) && (nodo.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(nodo.expression) && nodo.expression.text === "require"))) {
      const [arg] = nodo.arguments;
      hallados.push(arg && ts.isStringLiteral(arg) ? arg.text : "<dinámico>");
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallados;
}

/** Reloj, azar, red y entorno. */
function usosImpuros(fuente: ts.SourceFile): string[] {
  const hallados: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (ts.isPropertyAccessExpression(nodo) && ts.isIdentifier(nodo.expression)) {
      const nombre = `${nodo.expression.text}.${nodo.name.text}`;
      if (["Date.now", "Math.random", "process.env", "performance.now", "crypto.getRandomValues", "crypto.randomUUID"].includes(nombre)) hallados.push(nombre);
    }
    if (ts.isNewExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === "Date" && (nodo.arguments?.length ?? 0) === 0) hallados.push("new Date()");
    if (ts.isCallExpression(nodo) && ts.isIdentifier(nodo.expression) && nodo.expression.text === "fetch") hallados.push("fetch");
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallados;
}

/** Lecturas de un campo prohibido: `x.cantidad`, `x?.detalle`, `x["encargo"]` y `{ accion } = x`. */
function lecturasProhibidas(fuente: ts.SourceFile): string[] {
  const hallados: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (ts.isPropertyAccessExpression(nodo) && CAMPOS_PROHIBIDOS.has(nodo.name.text)) hallados.push(nodo.name.text);
    if (ts.isElementAccessExpression(nodo) && ts.isStringLiteral(nodo.argumentExpression) && CAMPOS_PROHIBIDOS.has(nodo.argumentExpression.text)) hallados.push(nodo.argumentExpression.text);
    if (ts.isBindingElement(nodo)) {
      const nombre = nodo.propertyName ?? nodo.name;
      if (ts.isIdentifier(nombre) && CAMPOS_PROHIBIDOS.has(nombre.text)) hallados.push(nombre.text);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallados;
}

const analizar = (codigo: string, nombre = "fragmento.ts"): ts.SourceFile => ts.createSourceFile(nombre, codigo, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const prohibido = (especificador: string): boolean => MODULOS_PROHIBIDOS.some((r) => r.test(especificador));

function archivos(): string[] {
  if (!existsSync(CARPETA)) return [];
  const propios = readdirSync(CARPETA, { recursive: true, encoding: "utf8" }).filter((n) => /\.tsx?$/.test(n)).map((n) => path.join(CARPETA, n));
  return [...propios, PRESENTAR];
}

describe("candado de pureza · control positivo", () => {
  it("el detector de imports muerde la base, la red, los clientes y server-only, y deja pasar los import type", () => {
    const codigo = [
      'import { Prisma } from "@prisma/client";', 'import "server-only";', 'import { db } from "@/lib/db";', 'import { readFileSync } from "node:fs";',
      'import https from "https";', 'export { leer } from "../../lib/http-acotado";', 'const m = await import("@/ia/puertas");', 'const n = require("../nube/cliente");',
      'import type { Tablero } from "../../tablero/calculo";', 'export type { Unidad } from "../contrato";', 'import { cop } from "../../app/tablero/formato";',
    ].join("\n");
    expect(importsDeEjecucion(analizar(codigo)).filter(prohibido)).toEqual([
      "@prisma/client", "server-only", "@/lib/db", "node:fs", "https", "../../lib/http-acotado", "@/ia/puertas", "../nube/cliente",
    ]);
  });

  it("el detector de impurezas muerde el reloj, el azar, la red y el entorno", () => {
    const codigo = "const a = Date.now(); const b = new Date(); const c = Math.random(); const d = fetch(u); const e = process.env.X; const ok = new Date(t);";
    expect(usosImpuros(analizar(codigo))).toEqual(["Date.now", "new Date()", "Math.random", "fetch", "process.env"]);
  });

  it("el detector de lecturas muerde cada forma de leer un campo prohibido", () => {
    const codigo = 'const a = r.cantidad; const b = r?.detalle; const c = r["encargo"]; const { accion } = r; const { tenencia: t } = p; const ok = r.nivel;';
    expect(lecturasProhibidas(analizar(codigo))).toEqual(["cantidad", "detalle", "encargo", "accion", "tenencia"]);
  });
});

describe("candado de pureza · control positivo de las formas que se saltaban el detector (revisión de seguridad)", () => {
  it("import x = require(...) también es un import de ejecución", () => {
    expect(importsDeEjecucion(analizar('import fs = require("node:fs");\nimport type T = require("./tipos");')).filter(prohibido)).toEqual(["node:fs"]);
  });

  it("el reloj, el azar, la red y el entorno por alias, por desestructuración o por globalThis", () => {
    const codigo = [
      "const D = Date; const a = new D();", "const { now } = Date;", "const b = Date();", "const c = globalThis.fetch(u);",
      'const d = process["env"];', "const { env } = process;", "const e = eval(x);", "const f = new Function(x);", "const g = Reflect.get(o, k);",
      "const { random } = Math;", "const ok = Date.parse(t) + Date.UTC(2027, 2, 17) + Math.abs(n) + Math.max(n, m); const tipo: Date = new Date(t);",
    ].join("\n");
    expect(usosImpuros(analizar(codigo))).toEqual([
      "Date", "Date", "Date", "globalThis", "process", "process", "eval", "Function", "Reflect", "Math",
    ]);
  });

  it("las lecturas con plantilla, y los volcados de un objeto entero (Object.values, JSON.stringify, structuredClone)", () => {
    const codigo = [
      "const a = r[`cantidad`];", "const b = Object.values(r);", "const c = Object.entries(r);", "const d = JSON.stringify(r);", "const e = structuredClone(r);",
      "const f = Object.assign({}, r);", "const g = r.costoVivo;", "const h = r.decisiones;", "const ok = Object.freeze([]);",
    ].join("\n");
    expect(lecturasProhibidas(analizar(codigo))).toEqual([
      "cantidad", "Object.values", "Object.entries", "JSON.stringify", "structuredClone", "Object.assign", "costoVivo", "decisiones",
    ]);
  });

  it("el grafo de imports: lo prohibido se ve también si llega de forma transitiva", () => {
    const archivos: Readonly<Record<string, string>> = {
      "/raiz/src/ia/hechos/a.ts": 'import { b } from "./b";\nimport type { T } from "../../lib/db";',
      "/raiz/src/ia/hechos/b.ts": 'import { c } from "@/plan/c";\nimport { Prisma } from "@prisma/client";',
      "/raiz/src/plan/c.ts": 'import { t } from "./tenencia";\nimport "server-only";',
      "/raiz/src/plan/tenencia.ts": "export const t = 1;",
    };
    const sistema = { raiz: "/raiz", leer: (ruta: string) => archivos[ruta] ?? null };
    expect(prohibidosAlcanzados(["/raiz/src/ia/hechos/a.ts"], sistema)).toEqual(["src/plan/c.ts → ./tenencia", "src/plan/c.ts → server-only"]);
  });
});

describe("candado de pureza · los armadores y presentar", () => {
  it("existen los archivos que vigila (si no, la prueba no vigilaría nada)", () => {
    const vigilados = archivos();
    expect(vigilados.length).toBeGreaterThanOrEqual(8);
    for (const nombre of ["diario.ts", "reglas.ts", "escenarios.ts", "grupos.ts", "derivar.ts"]) expect(vigilados.some((p) => p.endsWith(nombre)), nombre).toBe(true);
  });

  it("ningún armador alcanza, ni de forma transitiva, la base, la red, server-only, los clientes de las puertas ni el cálculo de tenencias", () => {
    const sistema = { raiz: RAIZ, leer: (ruta: string) => (existsSync(ruta) ? readFileSync(ruta, "utf8") : null) };
    expect(prohibidosAlcanzados(archivos(), sistema)).toEqual([]);
  });

  it.each(archivos().map((p) => [path.relative(RAIZ, p), p] as const))("%s: sin base, red, reloj, azar ni campos prohibidos", (_nombre, ruta) => {
    const fuente = analizar(readFileSync(ruta, "utf8"), ruta);
    expect(importsDeEjecucion(fuente).filter(prohibido)).toEqual([]);
    expect(usosImpuros(fuente)).toEqual([]);
    expect(lecturasProhibidas(fuente)).toEqual([]);
  });
});
