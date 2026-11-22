/**
 * Candado de la frontera de la puerta nube (con control positivo de cada detector):
 * - el SDK de Anthropic se importa SOLO dentro de `src/ia/nube/`, y todo archivo de esa carpeta importa `server-only`
 *   (así `next build` falla si un componente de cliente lo alcanza, también de forma transitiva);
 * - ningún archivo «use client» importa `@/ia/nube` ni una ruta relativa que caiga en esa carpeta;
 * - dentro de la carpeta: nada de la API beta, ni de respaldos de otro modelo (`fallbacks`), ni lecturas de
 *   `process.env` (la configuración entra por `leerConfigNube`), y la llave se revela solo en el transporte.
 * Los especificadores los saca el analizador de TypeScript (import, export … from, import() y require()).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const SRC = path.join(RAIZ, "src");
const NUBE = path.join(SRC, "ia", "nube");
const CODIGO = /\.[cm]?[jt]sx?$/;
const ARCHIVOS_NUBE = ["config.ts", "tope.ts", "peticion.ts", "respuesta.ts", "transporte.ts", "generador-nube.ts"];
const IDENTIFICADORES_PROHIBIDOS = new Set(["beta", "betaRefusalFallbackMiddleware", "BetaFallbackState", "fallbacks"]);

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : CODIGO.test(n) ? [p] : [];
  });
}

const especificadores = (codigo: string): readonly string[] => ts.preProcessFile(codigo, true, true).importedFiles.map((f) => f.fileName);

/** ¿Importa el SDK (o una subruta)? */
const importaSdk = (codigo: string): boolean => especificadores(codigo).some((e) => e === "@anthropic-ai/sdk" || e.startsWith("@anthropic-ai/sdk/"));

/** ¿Importa algo de `src/ia/nube`, por el alias o por una ruta relativa desde `archivo`? */
function importaNube(codigo: string, archivo: string): boolean {
  return especificadores(codigo).some((e) => {
    if (/^@\/ia\/nube(?:\/|$)/.test(e)) return true;
    if (!e.startsWith(".")) return false;
    const destino = path.resolve(path.dirname(archivo), e);
    return destino === NUBE || destino.startsWith(`${NUBE}${path.sep}`);
  });
}

/** ¿Empieza con la directiva «use client»? */
function esDeCliente(codigo: string): boolean {
  const fuente = ts.createSourceFile("x.tsx", codigo, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  for (const sentencia of fuente.statements) {
    if (!ts.isExpressionStatement(sentencia) || !ts.isStringLiteral(sentencia.expression)) return false;
    if (sentencia.expression.text === "use client") return true;
  }
  return false;
}

/** Lo prohibido dentro de la carpeta: identificadores de la API beta y de respaldos, `process.env` y `.revelar()`. */
function usosProhibidos(codigo: string): { readonly prohibidos: readonly string[]; readonly revela: boolean } {
  const fuente = ts.createSourceFile("x.ts", codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const prohibidos: string[] = [];
  let revela = false;
  const visitar = (nodo: ts.Node): void => {
    if (ts.isIdentifier(nodo) && IDENTIFICADORES_PROHIBIDOS.has(nodo.text)) prohibidos.push(nodo.text);
    if (ts.isPropertyAccessExpression(nodo) && nodo.name.text === "env" && ts.isIdentifier(nodo.expression) && nodo.expression.text === "process") prohibidos.push("process.env");
    if (ts.isCallExpression(nodo) && ts.isPropertyAccessExpression(nodo.expression) && nodo.expression.name.text === "revelar") revela = true;
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return { prohibidos, revela };
}

describe("candado de la frontera de la nube · controles positivos", () => {
  it("importaSdk muerde cada forma de importar el SDK", () => {
    expect(importaSdk('import Anthropic from "@anthropic-ai/sdk";')).toBe(true);
    expect(importaSdk('export { APIError } from "@anthropic-ai/sdk";')).toBe(true);
    expect(importaSdk('const m = await import("@anthropic-ai/sdk/lib/transform-json-schema");')).toBe(true);
    expect(importaSdk('const m = require("@anthropic-ai/sdk");')).toBe(true);
    expect(importaSdk('import x from "@anthropic-ai/sdk-otro";')).toBe(false);
    expect(importaSdk('import x from "@/ia/nube/config";')).toBe(false);
  });

  it("importaNube muerde el alias y las rutas relativas que caen en la carpeta", () => {
    const desdeApp = path.join(SRC, "app", "pagina.tsx");
    expect(importaNube('import { crearGeneradorNube } from "@/ia/nube/generador-nube";', desdeApp)).toBe(true);
    expect(importaNube('import * as nube from "@/ia/nube";', desdeApp)).toBe(true);
    expect(importaNube('import { x } from "../ia/nube/config";', desdeApp)).toBe(true);
    expect(importaNube('import { x } from "../ia/nubes/config";', desdeApp)).toBe(false);
    expect(importaNube('import { x } from "@/ia/puertas";', desdeApp)).toBe(false);
  });

  it("esDeCliente reconoce la directiva solo al principio", () => {
    expect(esDeCliente('"use client";\nimport x from "y";')).toBe(true);
    expect(esDeCliente("'use strict';\n'use client';")).toBe(true);
    expect(esDeCliente('import x from "y";\n"use client";')).toBe(false);
    expect(esDeCliente('// "use client"\nexport const a = 1;')).toBe(false);
  });

  it("usosProhibidos muerde la API beta, los respaldos, process.env y ve .revelar()", () => {
    expect(usosProhibidos("cliente.beta.messages.create({});").prohibidos).toEqual(["beta"]);
    expect(usosProhibidos("const c = { fallbacks: [] };").prohibidos).toEqual(["fallbacks"]);
    expect(usosProhibidos("import { betaRefusalFallbackMiddleware } from 'x';").prohibidos).toEqual(["betaRefusalFallbackMiddleware"]);
    expect(usosProhibidos("const v = process.env.INV_IA_NUBE_LLAVE;").prohibidos).toEqual(["process"]);
    expect(usosProhibidos("const t = llave.revelar();").revela).toBe(true);
    expect(usosProhibidos("const t = llave.ocultar();")).toEqual({ prohibidos: [], revela: false });
    // Revisión de seguridad (BAJO B3): otras formas de escribir lo mismo.
    expect(usosProhibidos('const t = llave["revelar"]();').revela).toBe(true);
    expect(usosProhibidos("const { revelar } = llave;").revela).toBe(true);
    expect(usosProhibidos('const v = process["env"];').prohibidos).toEqual(["process"]);
    expect(usosProhibidos("const { env } = process;").prohibidos).toEqual(["process"]);
    expect(usosProhibidos("const v = globalThis.process;").prohibidos).toEqual(["process"]);
  });
});

describe("candado de la frontera de la nube · el código real", () => {
  it("la carpeta tiene sus archivos y todos importan server-only", () => {
    const propios = archivos(NUBE).map((p) => path.basename(p)).sort();
    expect(propios).toEqual([...ARCHIVOS_NUBE].sort());
    for (const nombre of ARCHIVOS_NUBE) {
      expect(especificadores(readFileSync(path.join(NUBE, nombre), "utf8")), nombre).toContain("server-only");
    }
  });

  it("fuera de src/ia/nube ningún archivo de src importa el SDK de Anthropic", () => {
    const todos = archivos(SRC).filter((p) => !p.startsWith(`${NUBE}${path.sep}`));
    expect(todos.length).toBeGreaterThan(100);
    expect(todos.filter((p) => importaSdk(readFileSync(p, "utf8"))).map((p) => path.relative(RAIZ, p))).toEqual([]);
  });

  it("ningún archivo «use client» importa la carpeta de la nube", () => {
    const deCliente = archivos(SRC).filter((p) => esDeCliente(readFileSync(p, "utf8")));
    expect(deCliente.length).toBeGreaterThan(0);
    expect(deCliente.filter((p) => importaNube(readFileSync(p, "utf8"), p)).map((p) => path.relative(RAIZ, p))).toEqual([]);
  });

  it("dentro de la carpeta: sin API beta, sin respaldos de otro modelo, sin process.env; la llave se revela solo en el transporte", () => {
    for (const nombre of ARCHIVOS_NUBE) {
      const { prohibidos, revela } = usosProhibidos(readFileSync(path.join(NUBE, nombre), "utf8"));
      expect(prohibidos, nombre).toEqual([]);
      expect(revela, nombre).toBe(nombre === "transporte.ts");
    }
  });
});
