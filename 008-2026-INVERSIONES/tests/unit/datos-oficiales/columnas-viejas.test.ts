// Candado de las columnas viejas de dividendo (fase C, C1): montoBruto, retencion, tasaRetencion y decretadoId son
// obsoletas desde la migración *_datos_oficiales (el bruto sale del decreto y el cruce con lo recibido se calcula al
// leer: dividendo es de solo inserción). La base ya las exige nulas (dividendo_viejas_nulas_chk); esto frena antes, en
// el código, a quien las vuelva a usar, y deja ver lo que todavía las LEE (el motor de proyecciones lee decretadoId,
// que ahora es siempre nulo). Sus relaciones (`decretado` y `recibidos`) cuentan igual: por ellas también se escribe.
// Se borran en una migración posterior de «contrato» (expandir ahora, contraer después: la reversa --sin-migrar vuelve
// a una imagen que las lee). Si una aparición nueva es legítima (otra lectura), se suma aquí con su motivo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR_008 = path.join(__dirname, "..", "..", "..");
const CARPETAS = ["src", "scripts"];
const VIEJAS = /\b(montoBruto|retencion|tasaRetencion|decretadoId)\b|\b(decretado|recibidos)\s*:/g;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx|mjs|js|sh)$/.test(n) ? [p] : [];
  });
}

/** «archivo · identificador» de cada aparición en el código de la app y de los scripts. */
function apariciones(): string[] {
  const hallados = new Set<string>();
  for (const carpeta of CARPETAS) {
    for (const archivo of archivos(path.join(DIR_008, carpeta))) {
      for (const m of readFileSync(archivo, "utf8").matchAll(VIEJAS)) {
        hallados.add(`${path.relative(DIR_008, archivo).split(path.sep).join("/")} · ${m[1] ?? m[2]}`);
      }
    }
  }
  return [...hallados].sort();
}

describe("columnas viejas de dividendo · nadie las escribe", () => {
  it("solo las lee el motor de proyecciones (decretadoId, siempre nulo, y el conteo de recibidos)", () => {
    expect(apariciones()).toEqual([
      "src/proyecciones/dividendos.ts · decretadoId",
      "src/proyecciones/leer.ts · decretadoId",
      "src/proyecciones/leer.ts · recibidos",
      "src/proyecciones/tipos.ts · decretadoId",
    ]);
  });

  it("la expresión ve una escritura con Prisma, con SQL crudo y por la relación", () => {
    const hallar = (texto: string) => [...texto.matchAll(VIEJAS)].map((m) => m[1] ?? m[2]);
    expect(hallar('tx.dividendo.create({ data: { montoBruto: x, retencion: y, tasaRetencion: z } })')).toEqual(["montoBruto", "retencion", "tasaRetencion"]);
    expect(hallar('UPDATE "dividendo" SET "decretadoId" = $1')).toEqual(["decretadoId"]);
    expect(hallar("data: { decretado: { connect: { id } } }")).toEqual(["decretado"]);
    expect(hallar("data: { recibidos : { connect: [] } }")).toEqual(["recibidos"]);
    // Ni retencion_permitida (desplegar-prod.sh) ni el texto «Valor decretado por acción» cuentan.
    expect(hallar("retencion_permitida || return 0; /** Valor decretado por acción */")).toEqual([]);
  });
});
