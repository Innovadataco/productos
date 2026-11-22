// Candado: el motor de análisis es puro. Ningún archivo de src/analisis/** usa el reloj, el azar, la red, el proceso, la
// consola, la comparación por idioma, la base o un lector con base (solo se permiten sus tipos). Con control positivo.
import { describe, expect, it } from "vitest";
import { hallarImpurezas, impurezasTransitivas, leerSrc, leerZona } from "./candados";

const PLANTADOS: readonly (readonly [string, string])[] = [
  ["Date.now", "const t = Date.now();"],
  ["new Date() sin argumentos", "const hoy = new Date();"],
  ["Math.random", "const x = Math.random();"],
  ["performance.now", "const t = performance.now();"],
  ["process", "const u = process.env.DATABASE_URL;"],
  ["fetch", "await fetch(url);"],
  ["consola", "console.log(x);"],
  ["localeCompare", "a.localeCompare(b);"],
  ["server-only", 'import "server-only";'],
  ["PrismaClient", "import type { PrismaClient } from \"@prisma/client\";"],
  ["SQL crudo", "await db.$queryRaw`SELECT 1`;"],
  ["lector con base", 'import { leerEntradas } from "../proyecciones/leer";'],
  ["lector con base", 'import { resultadosDeDecisiones, type ResultadoDecision } from "../plan/resultados-lote";'],
  ["Date.now", 'const t = Date["now"]();'],
  ["Date.now", "const { now } = Date;"],
  ["Date() sin new", "const s = Date();"],
  ["new Date() sin argumentos", "const hoy = new Date(\n);"],
  ["crypto", "const id = crypto.randomUUID();"],
  ["require", 'const fs = require("node:fs");'],
  ["import dinámico", 'const m = await import("../plan/lectura");'],
  ["node:", 'import { readFileSync } from "node:fs";'],
  ["Intl o toLocale", "const t = x.toLocaleString();"],
  ["Intl o toLocale", "const f = new Intl.NumberFormat();"],
  ["globales del entorno", "globalThis.algo = 1;"],
  ["globales del entorno", "setTimeout(f, 1);"],
];

describe("candado de pureza · control positivo", () => {
  it.each(PLANTADOS)("%s plantado se detecta", (nombre, codigo) => {
    expect(hallarImpurezas(codigo)).toContain(nombre);
  });

  it("lo permitido no se detecta: los tipos de los lectores, una fecha con argumentos y Decimal", () => {
    const permitido = [
      'import type { ResultadoDecision } from "../plan/resultados-lote";',
      'import type { ReglaLeida } from "../plan/lectura";',
      "const d = new Date(Date.UTC(2021, 0, 4));",
      'import { Prisma } from "@prisma/client";',
    ].join("\n");
    expect(hallarImpurezas(permitido)).toEqual([]);
  });
});

describe("candado de pureza · lo que la zona importa, también de forma indirecta", () => {
  const zona = new Map([["a.ts", 'import { b } from "./b";\nimport type { T } from "../plan/lectura";\nimport { Prisma } from "@prisma/client";\n']]);

  it("un módulo de src que la zona alcanza y usa el reloj la pone en rojo, con el camino", () => {
    const src = new Map([["analisis/b.ts", 'import { c } from "../plan/c";\n'], ["plan/c.ts", "export const c = Date.now();\n"]]);
    expect(impurezasTransitivas(zona, (ruta) => src.get(ruta) ?? null)).toEqual(["analisis/a.ts → analisis/b.ts → plan/c.ts: Date.now"]);
  });

  it("un paquete que no es @prisma/client, o un módulo que no existe, también", () => {
    const conPaquete = new Map([["a.ts", 'import { z } from "zod";\nimport { x } from "../lib/no-existe";\n']]);
    expect(impurezasTransitivas(conPaquete, () => null)).toEqual(["analisis/a.ts: paquete zod", "analisis/a.ts: módulo ../lib/no-existe que no se encuentra"]);
  });

  it("los imports de solo tipos no se siguen (se borran al compilar)", () => {
    const src = new Map([["analisis/b.ts", "export const b = 1;\n"]]);
    expect(impurezasTransitivas(zona, (ruta) => src.get(ruta) ?? null)).toEqual([]);
  });
});

describe("candado de pureza · la zona", () => {
  it("ningún archivo de src/analisis es impuro", () => {
    const impuros = [...leerZona()].flatMap(([ruta, texto]) => hallarImpurezas(texto).map((n) => `${ruta}: ${n}`));
    expect(impuros).toEqual([]);
  });

  it("ni lo que alcanza por sus imports en src (reloj, azar, red, base, lectores con base)", () => {
    expect(impurezasTransitivas(leerZona(), leerSrc)).toEqual([]);
  });

  it("control positivo sobre el grafo real: un reloj plantado en un módulo reusado de segundo nivel se detecta", () => {
    const plantado = (ruta: string) => (ruta === "datos-oficiales/decretos/ventana.ts" ? `${leerSrc(ruta)}\nexport const t = Date.now();\n` : leerSrc(ruta));
    const avisos = impurezasTransitivas(leerZona(), plantado);
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos.every((a) => a.endsWith("datos-oficiales/decretos/ventana.ts: Date.now"))).toBe(true);
    expect(avisos[0]).toMatch(/^analisis\/\S+\.ts → .*proyecciones\/dividendos\.ts → datos-oficiales\/decretos\/ventana\.ts: Date\.now$/);
  });
});
