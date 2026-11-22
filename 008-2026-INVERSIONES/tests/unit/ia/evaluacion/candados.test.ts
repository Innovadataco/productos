/**
 * Candados estáticos del arnés de evaluación (E7), cada uno con su control positivo:
 * - en `src/ia/evaluacion` no hay red propia (ni el fetch global ni http, net o undici), ni IPv4 escritas, ni rutas
 *   «/api/…» escritas, ni `process.env`, ni azar ni reloj propios (`Math.random`, `Date.now`, `new Date()` sin
 *   argumentos): la red, el destino, el reloj y la semilla entran inyectados;
 * - nada de `src/ia/evaluacion` importa la puerta nube, el generador falso ni las pruebas;
 * - el auditor de recomendaciones no importa el validador (tiene que ser independiente de lo que audita);
 * - los dos scripts no importan pruebas ni la nube; el de evaluación no lleva IPv4 ni rutas de Ollama; el del export no
 *   abre la red ni escribe archivos (solo imprime por stdout).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const SRC_EVALUACION = path.join(RAIZ, "src", "ia", "evaluacion");
const SCRIPT_EVALUAR = path.join(RAIZ, "scripts", "ia-evaluar.ts");
const SCRIPT_EXPORTAR = path.join(RAIZ, "scripts", "exportar-hechos-ia.ts");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.ts$/.test(n) ? [p] : [];
  });
}

const leer = (p: string): string => readFileSync(p, "utf8");
const importados = (codigo: string): string[] => ts.preProcessFile(codigo, true, true).importedFiles.map((f) => f.fileName);

const usaRedPropia = (codigo: string): boolean =>
  /\bglobalThis\s*\.\s*fetch\b|(?<![.\w])fetch\s*\(|from\s+["'](?:node:)?(?:http|https|net|tls|dgram|undici)["']|require\(\s*["'](?:node:)?(?:http|https|net|tls|undici)["']\s*\)/.test(codigo);
const tieneIpv4 = (codigo: string): boolean => /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/.test(codigo);
const rutasEscritas = (codigo: string): string[] => [...codigo.matchAll(/["'`](\/api\/[^"'`\s]*)["'`]/g)].map((m) => m[1] as string);
const usaEntornoOAzar = (codigo: string): boolean => /\bprocess\s*\.\s*env\b|\bMath\s*\.\s*random\b|\bDate\s*\.\s*now\b|\bnew\s+Date\s*\(\s*\)/.test(codigo);
const importaProhibido = (codigo: string): boolean =>
  importados(codigo).some((f) => /(?:^|\/)nube(?:\/|$)|generador-falso|(?:^|\/)tests\//.test(f) || f.startsWith("../../../tests") || /^\.\.\/tests\//.test(f));
const importaValidador = (codigo: string): boolean => importados(codigo).some((f) => /validador/.test(f));
const escribeArchivos = (codigo: string): boolean => /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|openSync|mkdirSync|mkdir)\s*\(/.test(codigo);

describe("los detectores muerden (control positivo)", () => {
  it("red, IPv4, rutas, entorno y azar", () => {
    expect(usaRedPropia("await fetch(url)")).toBe(true);
    expect(usaRedPropia('import x from "node:http";')).toBe(true);
    expect(usaRedPropia("dependencias.buscar(url, init)")).toBe(false);
    expect(tieneIpv4(`destino ${[100, 73, 41, 157].join(".")}:47213`)).toBe(true);
    expect(tieneIpv4("qwen2.5:14b y next 16.4.6")).toBe(false);
    expect(rutasEscritas('const r = "/api/pull";')).toEqual(["/api/pull"]);
    expect(usaEntornoOAzar("const d = process.env.X;")).toBe(true);
    expect(usaEntornoOAzar("Math.random()")).toBe(true);
    expect(usaEntornoOAzar("const t = Date.now();")).toBe(true);
    expect(usaEntornoOAzar("const t = new Date();")).toBe(true);
    expect(usaEntornoOAzar('const t = new Date("2027-03-17T00:00:00.000Z");')).toBe(false);
  });

  it("imports prohibidos, el validador y la escritura de archivos", () => {
    expect(importaProhibido('import { crearGeneradorNube } from "../nube/generador-nube";')).toBe(true);
    expect(importaProhibido('import { crearGeneradorFalso } from "@/ia/generador-falso";')).toBe(true);
    expect(importaProhibido('import x from "../tests/unit/ia/apoyo/hechos.ficticio";')).toBe(true);
    expect(importaProhibido('import { promptDe } from "../prompts/prompts";')).toBe(false);
    expect(importaValidador('import { validarSalida } from "../validador/validar";')).toBe(true);
    expect(escribeArchivos("writeFileSync(ruta, datos)")).toBe(true);
    expect(escribeArchivos("process.stdout.write(json)")).toBe(false);
  });
});

describe("candados de src/ia/evaluacion", () => {
  const codigo = archivos(SRC_EVALUACION);

  it("revisa los módulos del arnés", () => {
    expect(codigo.length).toBeGreaterThanOrEqual(12);
  });

  it("ningún módulo abre red por su cuenta, escribe una IPv4 ni una ruta de Ollama", () => {
    expect(codigo.filter((p) => usaRedPropia(leer(p))).map((p) => path.relative(RAIZ, p))).toEqual([]);
    expect(codigo.filter((p) => tieneIpv4(leer(p))).map((p) => path.relative(RAIZ, p))).toEqual([]);
    expect(codigo.flatMap((p) => rutasEscritas(leer(p)))).toEqual([]);
  });

  it("ningún módulo lee el entorno ni usa azar o reloj propios", () => {
    expect(codigo.filter((p) => usaEntornoOAzar(leer(p))).map((p) => path.relative(RAIZ, p))).toEqual([]);
  });

  it("ninguno importa la nube, el generador falso ni las pruebas", () => {
    expect(codigo.filter((p) => importaProhibido(leer(p))).map((p) => path.relative(RAIZ, p))).toEqual([]);
  });

  it("el auditor de recomendaciones no importa el validador", () => {
    expect(importaValidador(leer(path.join(SRC_EVALUACION, "auditoria.ts")))).toBe(false);
  });
});

describe("candados de los scripts", () => {
  it("ia-evaluar.ts: sin pruebas, sin nube, sin IPv4 ni rutas de Ollama; el fetch solo pasa por la red vigilada", () => {
    const texto = leer(SCRIPT_EVALUAR);
    expect(importaProhibido(texto)).toBe(false);
    expect(tieneIpv4(texto)).toBe(false);
    expect(rutasEscritas(texto)).toEqual([]);
    expect(texto).toMatch(/vigilarRed\(\s*fetch\s*,/);
    // El fetch global se usa una sola vez (la clave `fetch:` de las dependencias de la puerta local no cuenta).
    expect([...texto.matchAll(/(?<![.\w])fetch\b(?!\s*:)/g)]).toHaveLength(1);
  });

  it("exportar-hechos-ia.ts: sin pruebas, sin nube, sin red y sin escribir archivos", () => {
    const texto = leer(SCRIPT_EXPORTAR);
    expect(importaProhibido(texto)).toBe(false);
    expect(usaRedPropia(texto)).toBe(false);
    expect(escribeArchivos(texto)).toBe(false);
    expect(importados(texto).some((f) => /ia\/local|ia\/evaluacion\/(?:red|evaluar|corrida|salida)/.test(f))).toBe(false);
  });
});
