// Candado del módulo de gráficas (frente graficas-tablero): `src/app/_graficas/` es de cliente y reutilizable (el
// tablero y, después, las proyecciones). Solo puede importar `react` y sus propios archivos (`./`): nada del
// servidor, de Prisma, del tablero ni de `../`. Así ningún dato ni cálculo del servidor entra por aquí.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = fileURLToPath(new URL("../../../src/app/_graficas/", import.meta.url));
const IMPORTACION = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;
const PERMITIDO = /^(react|react-dom|\.\/[\w.-]+)$/;

const fugas = (fuentes: Readonly<Record<string, string>>): string[] =>
  Object.entries(fuentes).flatMap(([archivo, fuente]) => [...fuente.matchAll(IMPORTACION)].map((m) => m[1]!).filter((d) => !PERMITIDO.test(d)).map((d) => `${archivo} → ${d}`));

describe("frontera de src/app/_graficas", () => {
  const archivos = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));

  it("existe y sus componentes son de cliente", () => {
    expect(archivos).toEqual(expect.arrayContaining(["index.ts", "GraficaTiempo.tsx", "Dona.tsx", "Barras.tsx", "Selector.tsx"]));
    for (const f of archivos.filter((x) => x.endsWith(".tsx"))) expect(readFileSync(`${DIR}${f}`, "utf8")).toMatch(/^\s*["']use client["']/);
  });

  it("solo importa react y archivos propios", () => {
    expect(fugas(Object.fromEntries(archivos.map((f) => [f, readFileSync(`${DIR}${f}`, "utf8")])))).toEqual([]);
  });

  it("el candado muerde", () => {
    expect(fugas({
      "x.tsx": 'import { useState } from "react";\nimport "./graficas.css";\nimport { n } from "../tablero/formato";\nimport type { Vista } from "@/app/tablero/tipos";\nexport { y } from "@prisma/client";\n',
    })).toEqual(["x.tsx → ../tablero/formato", "x.tsx → @/app/tablero/tipos", "x.tsx → @prisma/client"]);
  });
});
