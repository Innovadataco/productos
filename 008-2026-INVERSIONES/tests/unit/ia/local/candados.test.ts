/**
 * Candados estáticos de la puerta local, cada uno con su control positivo (si el detector deja de morder, no sirve):
 * - en `src/ia/local` las únicas rutas de Ollama escritas son `/api/generate` y `/api/tags`;
 * - ningún módulo de `src/ia/local` usa el `fetch` global ni abre sockets: la red solo entra inyectada;
 * - ninguna IPv4 escrita en el código ni en las pruebas de la puerta local (el cruce de la Fábrica las marca todas);
 * - el módulo de modelos no se puede inyectar: solo se reemplaza en pruebas con `vi.mock`.
 * La conducta (que el cliente solo llama a esas dos URLs con su método) la prueban los demás archivos con el `fetch`
 * falso, que anota cada violación.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const SRC_LOCAL = path.join(RAIZ, "src", "ia", "local");
const PRUEBAS_LOCAL = path.join(RAIZ, "tests", "unit", "ia", "local");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.ts$/.test(n) ? [p] : [];
  });
}

const leer = (p: string): string => readFileSync(p, "utf8");

/** Las rutas «/api/…» escritas como texto (comillas, comillas simples o plantilla). */
function rutasEscritas(codigo: string): string[] {
  return [...codigo.matchAll(/["'`](\/api\/[^"'`\s]*)["'`]/g)].map((m) => m[1] as string);
}

/** ¿Usa el fetch global o abre red por su cuenta? */
function usaRedPropia(codigo: string): boolean {
  return /\bglobalThis\s*\.\s*fetch\b|(?<![.\w])fetch\s*\(|from\s+["'](?:node:)?(?:http|https|net|tls|dgram|undici)["']|require\(\s*["'](?:node:)?(?:http|https|net|tls|undici)["']\s*\)/.test(codigo);
}

/** Una IPv4 escrita: cuatro números de uno a tres dígitos separados por puntos. */
function tieneIpv4(codigo: string): boolean {
  return /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/.test(codigo);
}

describe("los detectores muerden (control positivo)", () => {
  it("rutasEscritas encuentra una ruta de más", () => {
    expect(rutasEscritas('const r = "/api/pull"; const s = `/api/tags`;')).toEqual(["/api/pull", "/api/tags"]);
  });

  it("usaRedPropia ve el fetch global, un import de http y un require de net", () => {
    expect(usaRedPropia("await fetch(url)")).toBe(true);
    expect(usaRedPropia("const f = globalThis.fetch;")).toBe(true);
    expect(usaRedPropia('import { request } from "node:http";')).toBe(true);
    expect(usaRedPropia('import x from "undici";')).toBe(true);
    expect(usaRedPropia('const n = require("net");')).toBe(true);
    expect(usaRedPropia("await buscar(url, init); dependencias.fetch;")).toBe(false);
  });

  it("tieneIpv4 ve una IPv4 armada aquí, y no una versión de tres partes", () => {
    expect(tieneIpv4(`destino ${[100, 73, 41, 157].join(".")}:47213`)).toBe(true);
    expect(tieneIpv4("next 16.4.6 y el rango 100.64/10")).toBe(false);
  });
});

describe("candados de src/ia/local", () => {
  const codigo = archivos(SRC_LOCAL);

  it("revisa los módulos de la puerta local", () => {
    expect(codigo.map((p) => path.basename(p)).sort()).toEqual(
      ["barrera.ts", "contexto.ts", "destino.ts", "errores.ts", "generador.ts", "http.ts", "modelos.ts", "ollama.ts", "plazo.ts", "semaforo.ts", "sonda.ts"],
    );
  });

  it("las únicas rutas escritas son /api/generate y /api/tags", () => {
    const rutas = new Set(codigo.flatMap((p) => rutasEscritas(leer(p))));
    expect([...rutas].sort()).toEqual(["/api/generate", "/api/tags"]);
  });

  it("ningún módulo usa el fetch global ni abre red por su cuenta", () => {
    expect(codigo.filter((p) => usaRedPropia(leer(p))).map((p) => path.basename(p))).toEqual([]);
  });

  it("ninguna IPv4 escrita, ni en el código ni en las pruebas de la puerta local", () => {
    const todos = [...codigo, ...archivos(PRUEBAS_LOCAL)];
    expect(todos.length).toBeGreaterThan(15);
    expect(todos.filter((p) => tieneIpv4(leer(p))).map((p) => path.relative(RAIZ, p))).toEqual([]);
  });

  it("la lista de modelos no tiene punto de inyección: fuera de modelos.ts nadie la recibe ni la lee", () => {
    const otros = codigo.filter((p) => path.basename(p) !== "modelos.ts").map(leer);
    expect(otros.some((texto) => /MODELOS_APROBADOS|modelosAprobados|aprobados\s*[?]?:/.test(texto))).toBe(false);
  });

  // E8: la lista la publica PI en un archivo. Solo modelos.ts lee la variable y el disco; ningún otro módulo de la
  // puerta local mira el entorno ni abre archivos (la configuración entra por `crearGeneradorLocal`).
  it("solo modelos.ts lee el entorno y el disco", () => {
    expect(leeEntornoODisco('const d = process.env[VARIABLE_DIR_COMPARTIDA];')).toBe(true);
    expect(leeEntornoODisco('import { readFileSync } from "node:fs";')).toBe(true);
    expect(leeEntornoODisco('import { openSync } from "fs";')).toBe(true);
    expect(leeEntornoODisco("const x = configuracion.destino;")).toBe(false);
    const otros = codigo.filter((p) => path.basename(p) !== "modelos.ts");
    expect(otros.filter((p) => leeEntornoODisco(leer(p))).map((p) => path.basename(p))).toEqual([]);
    expect(leeEntornoODisco(leer(path.join(SRC_LOCAL, "modelos.ts")))).toBe(true);
  });
});

/** ¿Lee el entorno (`process`) o importa el sistema de archivos? */
function leeEntornoODisco(codigo: string): boolean {
  return /\bprocess\b/.test(codigo) || /from\s+["'](?:node:)?fs(?:\/promises)?["']/.test(codigo);
}
