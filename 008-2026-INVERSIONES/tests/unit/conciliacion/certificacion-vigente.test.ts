// Candado (frente certificacion-corte-real): «la certificación de una fecha» es la VIGENTE. Una certificación
// retirada (corte equivocado) sigue en la base como historia con su fecha, así que nadie la busca por fecha de corte
// a mano: solo src/conciliacion/vigente.ts, y todo filtro de relación por la fecha de corte de la certificación lleva
// `retiradaEn: null`. Si alguien suma una lectura nueva por fecha sin pasar por ahí, esto se pone rojo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(__dirname, "..", "..", "..", "src");
const UNICO = path.join("conciliacion", "vigente.ts");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const fuentes = () => archivos(SRC).map((a) => ({ ruta: path.relative(SRC, a), texto: readFileSync(a, "utf8") }));

describe("certificación vigente · un solo lugar la busca por fecha de corte", () => {
  it("solo vigente.ts consulta certificacion por fechaCorte", () => {
    const POR_FECHA = /\bcertificacion\s*\.\s*(findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|count)\s*\(\s*\{[^;]*?\bfechaCorte\b/;
    const hallados = fuentes().filter((f) => f.ruta !== UNICO && POR_FECHA.test(f.texto)).map((f) => f.ruta);
    expect(hallados).toEqual([]);
  });

  it("vigente.ts existe y filtra las retiradas", () => {
    const texto = readFileSync(path.join(SRC, UNICO), "utf8");
    expect(texto).toMatch(/retiradaEn:\s*null/);
  });

  it("todo filtro de relación por la fecha de corte de la certificación lleva retiradaEn: null", () => {
    const sinFiltro = fuentes().flatMap((f) =>
      [...f.texto.matchAll(/\bcertificacion\s*:\s*\{([^{}]*\bfechaCorte\b[^{}]*)\}/g)].filter((m) => !/\bretiradaEn\s*:\s*null\b/.test(m[1]!)).map(() => f.ruta),
    );
    expect(sinFiltro).toEqual([]);
  });
});
