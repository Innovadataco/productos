// Candado del retiro de la guarda del cruce (fase C, C5b). C4a dejó --aplicar solo para bases de pruebas (CRUCE_PENDIENTE)
// hasta que el motor de proyecciones cruzara los decretos con los pagos de Trii por ventana; C5b lo hace
// (src/proyecciones/dividendos.ts con src/datos-oficiales/decretos/ventana.ts) y retira JUNTAS las tres piezas:
// exigirCruce y basePermiteAplicar (guardar.ts) y AVISO_CRUCE (argumentos.ts), con lo que dependía de ellas. Que no
// vuelva ninguna, ni el nombre de la base como condición para escribir. Recorre los decretos y su CLI.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const DECRETOS = path.join(RAIZ, "src", "datos-oficiales", "decretos");
const ARCHIVOS = [...readdirSync(DECRETOS).filter((n) => n.endsWith(".ts")).map((n) => path.join(DECRETOS, n)), path.join(RAIZ, "scripts", "importar-decretos.ts")];
const RESTOS = /\b(exigirCruce|basePermiteAplicar|AVISO_CRUCE|CRUCE_PENDIENTE|nombreDeLaBase|aplicarPermitido|current_database)\b|_test\b|NO cargue decretos reales/g;

const restos = (): string[] =>
  ARCHIVOS.flatMap((a) => [...readFileSync(a, "utf8").matchAll(RESTOS)].map((m) => `${path.relative(RAIZ, a)} · ${m[0]}`));

describe("decretos · sin la guarda del cruce de C4a", () => {
  it("ninguna de sus piezas queda en los decretos ni en su CLI", () => {
    expect(ARCHIVOS.length).toBeGreaterThanOrEqual(9);
    expect(restos()).toEqual([]);
  });

  it("control positivo: el detector reconoce cada pieza", () => {
    const hallar = (t: string) => [...t.matchAll(RESTOS)].map((m) => m[0]);
    expect(hallar("await exigirCruce(tx); basePermiteAplicar(n); ...AVISO_CRUCE")).toEqual(["exigirCruce", "basePermiteAplicar", "AVISO_CRUCE"]);
    expect(hallar('"CRUCE_PENDIENTE" nombreDeLaBase aplicarPermitido SELECT current_database()')).toEqual(["CRUCE_PENDIENTE", "nombreDeLaBase", "aplicarPermitido", "current_database"]);
    expect(hallar("/^[a-z0-9_]+_test$/ · NO cargue decretos reales")).toEqual(["_test", "NO cargue decretos reales"]);
  });
});
