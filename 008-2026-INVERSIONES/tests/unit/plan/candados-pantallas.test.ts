// Candados de las pantallas del plan y del diario (fase B, corte 3): componentes del servidor sin JavaScript en el
// navegador ni HTML crudo, y lecturas que nunca traen el crudo de las filas importadas ni el encargo de A&V.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../../src/", import.meta.url).pathname;
const DIRECTORIOS = ["app/plan", "app/decisiones", "app/_plan"].map((d) => join(SRC, d));
const LECTURAS = ["plan/lectura.ts", "app/plan/datos.ts", "app/decisiones/datos.ts", "app/decisiones/[id]/datos.ts"].map((f) => join(SRC, f));

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

/** Lo que una pantalla de solo lectura no puede tener. */
export function violacionesDePantalla(texto: string): string[] {
  return [
    ...(/["']use client["']/.test(texto) ? ["use client"] : []),
    ...(/["']use server["']/.test(texto) ? ["use server"] : []),
    ...(/dangerouslySetInnerHTML/.test(texto) ? ["dangerouslySetInnerHTML"] : []),
  ];
}

/** Lo que una lectura de estas pantallas nunca selecciona. */
export const violacionesDeLectura = (texto: string): string[] => ["crudo", "encargo", "claveHash", "totpSecreto"].filter((c) => new RegExp(`\\b${c}\\b`).test(texto));

describe("candados de las pantallas del plan y del diario", () => {
  it("los candados muerden (prueba por mutación)", () => {
    expect(violacionesDePantalla('"use client";\nexport const x = 1;')).toEqual(["use client"]);
    expect(violacionesDePantalla("<div dangerouslySetInnerHTML={{ __html: x }} />")).toEqual(["dangerouslySetInnerHTML"]);
    expect(violacionesDeLectura("select: { crudo: true }")).toEqual(["crudo"]);
  });

  it("existen los tres directorios y tienen archivos (si no, no probaría nada)", () => {
    for (const d of DIRECTORIOS) expect(archivos(d).length, d).toBeGreaterThan(0);
  });

  it("ningún archivo de las pantallas usa JavaScript de cliente, Server Actions ni HTML crudo", () => {
    for (const ruta of DIRECTORIOS.flatMap(archivos)) expect(violacionesDePantalla(readFileSync(ruta, "utf8")), ruta).toEqual([]);
  });

  it("ninguna lectura trae el crudo, el encargo ni secretos de la cuenta", () => {
    for (const ruta of LECTURAS) expect(violacionesDeLectura(readFileSync(ruta, "utf8")), ruta).toEqual([]);
  });

  it("cada página exige la sesión antes de leer", () => {
    for (const ruta of DIRECTORIOS.flatMap(archivos).filter((r) => r.endsWith("page.tsx"))) {
      const t = readFileSync(ruta, "utf8");
      expect(t, ruta).toMatch(/await exigirSesion\(\);[\s\S]*datos\w*\(/);
    }
  });
});
