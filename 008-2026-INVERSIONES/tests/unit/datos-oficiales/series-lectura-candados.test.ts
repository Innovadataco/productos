// Candados de la lectura de series (fase C, C5a):
// - consulta.ts y frescura.ts son puros y livianos: la pantalla (C6a) los usará desde src/app. Solo importan el
//   catálogo, las fechas del plan y entre sí (no csv-series.ts, que arrastra el cliente HTTP por precios/yahoo, ni
//   @prisma/client). Los especificadores los saca el analizador de TypeScript (las mismas formas que
//   tests/unit/lib/lectores-candado.test.ts).
// - leer.ts toca la base: importa "server-only" (nunca llega a un componente de cliente).
// - MAX_DIAS_TRAS_DESDE_LECTURA (el piso del rango: el desde más viejo que todavía puede tocarlo) es el mismo 31 del
//   CHECK valor_serie_oficial_vigencia_chk de la migración, leído del archivo (no copiado).
// - SERIES_INDICE: cada serie índice está en el catálogo y es mensual (MES).
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { serieDelCatalogo } from "@/datos-oficiales/catalogo";
import { SERIES_INDICE } from "@/datos-oficiales/series/consulta";
import { MAX_DIAS_TRAS_DESDE_LECTURA } from "@/datos-oficiales/series/leer";

const RAIZ = path.join(__dirname, "..", "..", "..");
const SERIES = path.join(RAIZ, "src", "datos-oficiales", "series");
const leer = (archivo: string) => readFileSync(path.join(SERIES, archivo), "utf8");
const importsDe = (codigo: string) => ts.preProcessFile(codigo, true, true).importedFiles.map((f) => f.fileName);
const PERMITIDOS = new Set(["../catalogo", "./consulta", "../../plan/fechas"]);

describe("lectura de series · candados", () => {
  it("consulta.ts y frescura.ts solo importan el catálogo, las fechas del plan y entre sí", () => {
    for (const archivo of ["consulta.ts", "frescura.ts"]) {
      expect(importsDe(leer(archivo)).filter((e) => !PERMITIDOS.has(e)), archivo).toEqual([]);
    }
  });

  it("control positivo: el detector ve csv-series, @prisma/client, un import() y un require()", () => {
    const malo = 'import { canonizarValor } from "./csv-series";\nimport type { Prisma } from "@prisma/client";\nconst a = import("../../lib/http-acotado");\nconst b = require("node:fs");';
    expect(importsDe(malo).filter((e) => !PERMITIDOS.has(e))).toEqual(["./csv-series", "@prisma/client", "../../lib/http-acotado", "node:fs"]);
  });

  it("leer.ts importa server-only en su primera línea de código", () => {
    expect(importsDe(leer("leer.ts"))[0]).toBe("server-only");
    expect(leer("leer.ts").startsWith('import "server-only";')).toBe(true);
  });

  it("el piso del rango (31 días) es el del CHECK de la vigencia en la migración", () => {
    const migracion = readFileSync(path.join(RAIZ, "prisma", "migrations", "20261122030100_datos_oficiales", "migration.sql"), "utf8");
    const m = /"valor_serie_oficial_vigencia_chk" CHECK \(isfinite\("desde"\) AND "hasta" >= "desde" AND "hasta" <= "desde" \+ ([0-9]+)\)/.exec(migracion);
    expect(m?.[1]).toBeDefined();
    expect(MAX_DIAS_TRAS_DESDE_LECTURA).toBe(Number(m![1]));
  });

  it("cada serie índice está en el catálogo y es mensual", () => {
    expect(SERIES_INDICE.length).toBeGreaterThan(0);
    for (const codigo of SERIES_INDICE) expect(serieDelCatalogo(codigo)?.vigencia.tipo, codigo).toBe("MES");
  });
});
