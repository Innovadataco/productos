// Candado: el motor de análisis es puro. Ningún archivo de src/analisis/** usa el reloj, el azar, la red, el proceso, la
// consola, la comparación por idioma, la base o un lector con base (solo se permiten sus tipos). Con control positivo.
import { describe, expect, it } from "vitest";
import { hallarImpurezas, leerZona } from "./candados";

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

describe("candado de pureza · la zona", () => {
  it("ningún archivo de src/analisis es impuro", () => {
    const impuros = [...leerZona()].flatMap(([ruta, texto]) => hallarImpurezas(texto).map((n) => `${ruta}: ${n}`));
    expect(impuros).toEqual([]);
  });
});
