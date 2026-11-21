// Candado de la cobertura UNIDA (unidad + integración en un solo reporte, con vitest --merge-reports).
// Los pisos separados medían todo src/** con una sola suite (el código con base lo cubre la integración y
// el puro, la unidad) y rompían cada PR. Ahora el único piso es el de la medida unida.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import unidad from "../../../vitest.config";
import integracion from "../../../vitest.integracion.config";

const DIR_008 = fileURLToPath(new URL("../../../", import.meta.url));
const leer = (ruta: string) => readFileSync(path.join(DIR_008, ruta), "utf8");

/** Pisos aprobados en la GATE 1 (2026-11-21, medido − 1 punto). Trinquete: subirlos no toca esta prueba; bajarlos, sí. */
const PISOS_APROBADOS = { statements: 92, branches: 93, functions: 97, lines: 92 } as const;
/** Mínimo de ECC (rules/common/testing.md): ningún piso unido baja de aquí. */
const MINIMO_ECC = 80;
/** Blobs de las dos suites: solo los escribe `test:cobertura:unidad`/`:integracion` y solo los lee `:unir`. */
const DIR_BLOBS = "node_modules/.cache/cobertura-blobs";

type Cobertura = {
  enabled?: boolean;
  provider?: string;
  include?: string[];
  exclude?: string[];
  all?: boolean;
  reportsDirectory?: string;
  thresholds?: Record<string, unknown> & { autoUpdate?: unknown };
};
type Config = { test?: { include?: string[]; reporters?: unknown; coverage?: Cobertura } };

const cobertura = (c: unknown): Cobertura => (c as Config).test?.coverage ?? {};
const cargarUnida = async (): Promise<Config> => (await import("../../../vitest.cobertura.config")).default as Config;

describe("pisos separados (retirados: medían el universo equivocado)", () => {
  it.each([
    ["vitest.config.ts", unidad],
    ["vitest.integracion.config.ts", integracion],
  ])("%s no tiene thresholds (si los tuviera, cortarían la cadena de la medida unida)", (_nombre, config) => {
    expect(cobertura(config).thresholds).toBeUndefined();
  });
});

describe("vitest.cobertura.config.ts · solo une los blobs", () => {
  it("tiene la cobertura activada en el config (sin `enabled`, el merge sale en verde SIN medir)", async () => {
    expect(cobertura(await cargarUnida()).enabled).toBe(true);
  });

  it("no corre pruebas: include vacío (corrido sin --merge-reports sale con «No test files found»)", async () => {
    expect((await cargarUnida()).test?.include).toEqual([]);
  });

  it("no usa el reporter blob (el merge lo rechaza) ni reescribe sus pisos (autoUpdate)", async () => {
    const config = await cargarUnida();
    expect(JSON.stringify(config.test?.reporters ?? [])).not.toContain("blob");
    expect(cobertura(config).thresholds?.autoUpdate).toBeFalsy();
  });

  it.each(Object.entries(PISOS_APROBADOS))("piso de %s ≥ el aprobado (%i) y ≥ el 80 % de ECC", async (metrica, aprobado) => {
    const piso = cobertura(await cargarUnida()).thresholds?.[metrica];
    expect(typeof piso).toBe("number");
    expect(piso as number).toBeGreaterThanOrEqual(aprobado);
    expect(piso as number).toBeGreaterThanOrEqual(MINIMO_ECC);
  });
});

describe("los tres configs miden el mismo universo", () => {
  it("mismo provider, include y exclude, y ninguno con all: false (inflaría el %)", async () => {
    const tres = [cobertura(unidad), cobertura(integracion), cobertura(await cargarUnida())];
    for (const c of tres) {
      expect(c.provider).toBe("v8");
      expect(c.include).toEqual(["src/**/*.{ts,tsx}"]);
      expect(c.exclude).toEqual(tres[0]!.exclude);
      expect(c.all).not.toBe(false);
    }
  });

  it("cada uno con su directorio de reportes, y ninguno contiene ni está dentro del de blobs (la limpieza lo borraría)", async () => {
    const dirs = [unidad, integracion, await cargarUnida()].map((c) => cobertura(c).reportsDirectory ?? "coverage");
    const seSolapan = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
    expect(new Set(dirs).size).toBe(dirs.length);
    for (const dir of dirs) expect(seSolapan(dir, DIR_BLOBS)).toBe(false);
  });
});

describe("package.json · scripts de la cobertura unida", () => {
  const scripts = (JSON.parse(leer("package.json")) as { scripts: Record<string, string> }).scripts;

  it("test:cobertura es la unida (un nombre, un significado)", () => {
    expect(scripts["test:cobertura"]).toBe("npm run test:cobertura:unida");
  });

  it("la unida encadena unidad → integración → unir, y se corta en el primer fallo (&&)", () => {
    expect(scripts["test:cobertura:unida"]).toBe(
      "npm run test:cobertura:unidad && npm run test:cobertura:integracion && npm run test:cobertura:unir",
    );
  });

  it("la unidad limpia primero los blobs (uno viejo inflaría la cifra) y corre el mismo config de `npm test`", () => {
    expect(scripts["test:cobertura:unidad"]).toBe(
      `rm -rf ${DIR_BLOBS} && vitest run --config vitest.config.ts --coverage --reporter=default --reporter=blob --outputFile.blob=${DIR_BLOBS}/unidad.json`,
    );
  });

  it("la integración pasa por scripts/integracion.mjs (su candado de base *_test local), nunca por vitest directo", () => {
    expect(scripts["test:cobertura:integracion"]).toBe(
      `node scripts/integracion.mjs --coverage --reporter=default --reporter=blob --outputFile.blob=${DIR_BLOBS}/integracion.json`,
    );
  });

  it("unir usa el config de la medida unida sobre el directorio de blobs", () => {
    expect(scripts["test:cobertura:unir"]).toBe(`vitest run --config vitest.cobertura.config.ts --merge-reports=${DIR_BLOBS}`);
  });
});

describe(".dockerignore", () => {
  it("deja fuera de la imagen el config de la medida unida, como los otros dos", () => {
    const lineas = leer(".dockerignore").split("\n");
    for (const config of ["vitest.config.ts", "vitest.integracion.config.ts", "vitest.cobertura.config.ts"]) {
      expect(lineas).toContain(config);
    }
  });
});
