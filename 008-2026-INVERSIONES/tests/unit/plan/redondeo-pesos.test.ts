// Paridad del redondeo de pesos: precio() (pantallas del plan) y textoPesos() (simulador) son una sola cuenta, mitad hacia
// arriba y exacta (sin punto flotante). Y los porcentajes de peso van con dos decimales en toda la app, con UNA constante.
// Datos inventados.
import { Prisma } from "@prisma/client";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { precio } from "@/app/_plan/formato";
import { textoPesos } from "@/operar/simulador/textos";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src");

describe("precio() y textoPesos() redondean igual", () => {
  const TABLA: ReadonlyArray<readonly [string, string]> = [
    ["1.005", "$ 1,01"],
    ["2.675", "$ 2,68"],
    ["6202.9250", "$ 6.202,93"],
    ["0.125", "$ 0,13"],
    ["-0.005", "−$ 0,01"],
    ["9.995", "$ 10"],
  ];
  it.each(TABLA)("%s sale %s en las dos", (entrada, esperado) => {
    expect(textoPesos(new Prisma.Decimal(entrada))).toBe(esperado);
    expect(precio(entrada)).toBe(esperado);
  });
  it("conserva lo que ya hacía: sin ceros de más, sin dato y texto no decimal", () => {
    expect(precio("9.500000")).toBe("$ 9,5");
    expect(precio("1200")).toBe("$ 1.200");
    expect(precio(null)).toBe("—");
    expect(precio("abc")).toBe("—");
  });
});

const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });

describe("los pesos van con dos decimales y una sola constante", () => {
  const todos = archivos(SRC);
  it("DECIMALES_PESO se declara una sola vez", () => {
    const con = todos.filter((r) => /\bconst DECIMALES_PESO\s*=/.test(readFileSync(r, "utf8"))).map((r) => relative(SRC, r));
    expect(con).toEqual(["operar/analisis/decimales.ts"]);
  });
  it.each(["app/tablero/Tablero.tsx", "app/tablero/Foto.tsx"])("%s muestra el peso con DECIMALES_PESO y no con 1 decimal", (ruta) => {
    const codigo = readFileSync(join(SRC, ruta), "utf8");
    expect(codigo).toMatch(/numero\(n\((f|t)\.pesoPct\), DECIMALES_PESO\)/);
    expect(codigo).not.toMatch(/pesoPct\), 1\)/);
  });
});
