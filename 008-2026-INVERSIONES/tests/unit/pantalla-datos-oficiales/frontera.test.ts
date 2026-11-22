// Candados de la frontera de /datos-oficiales (frente datos-oficiales-pantalla, C6a; la sección de decretos, C6b):
// - lo que llega al navegador (los «use client» de la carpeta y lo que importan de ella) solo importa con valor de una
//   lista blanca: react, el módulo de gráficas, el formato del tablero y sus propios módulos puros (nunca Prisma,
//   server-only, la base, la sesión, la lectura ni el catálogo con sus reglas);
// - la lectura (datos.ts) carga server-only primero y no alcanza nada que escriba (lo vigila, para toda la app,
//   tests/unit/auth/escrituras.candado.test.ts; aquí, que la lectura use solo los módulos de lectura);
// - en la carpeta, ningún formato que dependa de la zona o el idioma del navegador (Intl, toLocale*, getters locales de
//   Date): lo que pinta el servidor es lo que hidrata;
// - la página no es pública: el proxy le exige la sesión.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { esPublica } from "@/auth/rutas";

const DIR = fileURLToPath(new URL("../../../src/app/datos-oficiales/", import.meta.url));
const IMPORTACION = /^\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']|\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/gm;
const PERMITIDO_CLIENTE = /^(react|react-dom|@\/app\/_graficas|@\/app\/tablero\/formato|\.\/[\w.-]+\.css)$/;
const LECTURA_PERMITIDA = new Set([
  "server-only", "@prisma/client", "@/conciliacion/leer", "@/datos-oficiales/catalogo", "@/datos-oficiales/series/consulta", "@/datos-oficiales/series/leer",
  // C6b: el cruce y los próximos de C5b, en la misma transacción.
  "@/datos-oficiales/decretos/leer", "@/plan/fechas", "./serializar", "./serializar-decretos", "./tipos",
]);
const LOCAL = /\bIntl\b|\.toLocale[A-Za-z]*\(|\.get(?:FullYear|Month|Date|Day|Hours|Minutes|Seconds|TimezoneOffset)\(/;
/** En el navegador, «ahora» no es el del servidor: lo del cliente no lo lee. */
const AHORA = /\bnew Date\(\s*\)|\bDate\.now\(/;

const leer = (f: string) => readFileSync(`${DIR}${f}`, "utf8");
const todos = () => readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));
const importaciones = (fuente: string) => [...fuente.matchAll(IMPORTACION)].map((m) => ({ soloTipo: Boolean(m[1]), desde: (m[2] ?? m[3])! }));
const sinComentarios = (fuente: string) => fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Los «use client» de la carpeta y lo que importan de ella (./x), recursivo. */
function delCliente(): string[] {
  const archivos = todos();
  const resolver = (d: string) => archivos.find((f) => f.replace(/\.(ts|tsx)$/, "") === d.replace(/^\.\//, ""));
  const pendientes = archivos.filter((f) => /^\s*["']use client["']/.test(leer(f)));
  const vistos = new Set<string>();
  while (pendientes.length > 0) {
    const f = pendientes.pop()!;
    if (vistos.has(f)) continue;
    vistos.add(f);
    importaciones(leer(f)).filter((i) => !i.soloTipo && i.desde.startsWith("./") && !i.desde.endsWith(".css")).forEach((i) => { const r = resolver(i.desde); if (r) pendientes.push(r); });
  }
  return [...vistos].sort();
}

/** Importaciones de valor fuera de la lista blanca (las de la carpeta se revisan al recorrerlas). */
function fugas(fuentes: Readonly<Record<string, string>>): string[] {
  return Object.entries(fuentes).flatMap(([archivo, fuente]) =>
    importaciones(fuente).filter((i) => !i.soloTipo && !(i.desde.startsWith("./") && !i.desde.endsWith(".css")) && !PERMITIDO_CLIENTE.test(i.desde)).map((i) => `${archivo} → ${i.desde}`),
  );
}

describe("frontera de src/app/datos-oficiales", () => {
  const cliente = delCliente();

  it("encuentra la gráfica y lo que importa; la lectura, la página y la pantalla del servidor no entran", () => {
    expect(cliente).toEqual(["GraficaSerie.tsx", "formato.ts"]);
  });

  it("la sección de decretos (C6b) es del servidor: ni Decretos.tsx ni sus formatos llegan al navegador", () => {
    for (const f of ["Decretos.tsx", "formato-decretos.ts", "serializar-decretos.ts"]) {
      expect(todos(), f).toContain(f);
      expect(/^\s*["']use client["']/.test(leer(f)), f).toBe(false);
      expect(cliente, f).not.toContain(f);
    }
  });

  it("lo del navegador solo importa con valor de la lista blanca", () => {
    expect(fugas(Object.fromEntries(cliente.map((f) => [f, leer(f)])))).toEqual([]);
  });

  it("el candado muerde (también import() y require)", () => {
    expect(fugas({
      "x.tsx": 'import { db } from "@/lib/db";\nimport type { T } from "@/datos-oficiales/series/leer";\nimport { CATALOGO } from "@/datos-oficiales/catalogo";\nconst m = await import("@prisma/client");\nimport { cop } from "@/app/tablero/formato";\n',
    })).toEqual(["x.tsx → @/lib/db", "x.tsx → @/datos-oficiales/catalogo", "x.tsx → @prisma/client"]);
  });

  it("datos.ts carga server-only primero y solo lee con los módulos de lectura", () => {
    const fuente = leer("datos.ts");
    expect(importaciones(fuente)[0]?.desde).toBe("server-only");
    expect(importaciones(fuente).map((i) => i.desde).filter((d) => !LECTURA_PERMITIDA.has(d))).toEqual([]);
  });

  it("sin formatos de la zona o el idioma del navegador en la carpeta; lo del cliente no lee la hora", () => {
    for (const f of todos()) expect(LOCAL.test(sinComentarios(leer(f))), f).toBe(false);
    for (const f of cliente) expect(AHORA.test(sinComentarios(leer(f))), f).toBe(false);
    for (const malo of ["new Intl.NumberFormat()", "x.toLocaleString()", "d.getHours()"]) expect(LOCAL.test(malo), malo).toBe(true);
    expect(LOCAL.test("d.getUTCFullYear()")).toBe(false);
    expect(AHORA.test("const a = new Date();") && AHORA.test("Date.now()")).toBe(true);
    expect(AHORA.test('new Date("2021-03-17")')).toBe(false);
  });

  it.each([["GET", "/datos-oficiales"], ["HEAD", "/datos-oficiales"]])("%s %s no es pública (el proxy exige la sesión)", (metodo, ruta) => {
    expect(esPublica(metodo, ruta)).toBe(false);
  });
});
