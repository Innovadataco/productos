// Candados de la frontera de la pantalla de proyecciones (frente proyecciones-pantalla):
// - lo que llega al navegador (los «use client» de src/app/proyecciones y todo lo que importan de la carpeta) solo
//   importa con valor de una lista blanca: react, el módulo de gráficas, el formato del tablero, la navegación y los
//   tipos puros del motor; nunca Prisma, server-only, la base, la sesión, el lector ni el cálculo del servidor;
// - los módulos del servidor de la carpeta cargan server-only primero;
// - la página y su API no son públicas: el proxy les exige la sesión.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { esPublica } from "@/auth/rutas";

const DIR = fileURLToPath(new URL("../../../src/app/proyecciones/", import.meta.url));
const IMPORTACION = /^\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;
const PERMITIDO_CLIENTE = /^(react|react-dom|@\/app\/_graficas|@\/app\/tablero\/formato|@\/app\/tablero\/secciones|@\/proyecciones\/tipos|\.\/[\w.-]+\.css)$/;
const DEL_SERVIDOR = ["datos.ts", "servidor.ts"];

const leer = (f: string) => readFileSync(`${DIR}${f}`, "utf8");
const todos = () => readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));
const importaciones = (fuente: string) => [...fuente.matchAll(IMPORTACION)].map((m) => ({ soloTipo: Boolean(m[1]), desde: m[2]! }));

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

describe("frontera de src/app/proyecciones", () => {
  const cliente = delCliente();

  it("encuentra el simulador y lo que importa; los módulos del servidor no entran", () => {
    expect(cliente).toEqual(expect.arrayContaining(["Simulador.tsx", "Controles.tsx", "Indicadores.tsx", "Abanico.tsx", "Supuestos.tsx", "abanico.ts", "cola.ts", "opciones.ts"]));
    for (const f of [...DEL_SERVIDOR, "page.tsx", "controles.ts", "turno.ts"]) expect(cliente).not.toContain(f);
  });

  it("lo del navegador solo importa con valor de la lista blanca", () => {
    expect(fugas(Object.fromEntries(cliente.map((f) => [f, leer(f)])))).toEqual([]);
  });

  it("el candado muerde", () => {
    expect(fugas({
      "x.tsx": 'import type { P } from "@/proyecciones/proyectar";\nimport { proyectar } from "@/proyecciones/proyectar";\nimport { db } from "@/lib/db";\nimport { Prisma } from "@prisma/client";\nimport { cop } from "@/app/tablero/formato";\nimport "./proyecciones.css";\n',
    })).toEqual(["x.tsx → @/proyecciones/proyectar", "x.tsx → @/lib/db", "x.tsx → @prisma/client"]);
  });

  it("los módulos del servidor de la carpeta cargan server-only primero", () => {
    for (const f of DEL_SERVIDOR) expect(importaciones(leer(f))[0]?.desde, f).toBe("server-only");
  });

  it.each([["GET", "/proyecciones"], ["HEAD", "/proyecciones"], ["POST", "/api/proyecciones"]])("%s %s no es pública (el proxy exige la sesión)", (metodo, ruta) => {
    expect(esPublica(metodo, ruta)).toBe(false);
  });
});
