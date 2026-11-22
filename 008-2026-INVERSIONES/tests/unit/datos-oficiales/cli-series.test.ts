// scripts/importar-series.ts como proceso, sin base: los errores de uso salen con 2 y los de contenido con 1, ANTES de
// tocar la base; con un CSV válido y la base inalcanzable, 1 con solo el nombre del error. Nada imprime valores, rutas ni
// la URL de la base; en producción (NODE_ENV=production, la imagen del migrador) todo fallo termina con PARE_VIA_B. La
// base es inalcanzable a propósito (puerto 1 de 127.0.0.1) y el entorno del hijo es mínimo. Cifras inventadas; fechas
// anteriores a 2022 (el proceso mide el adelanto contra el hoy real).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar, correr, entornoMinimo } from "../../ayudas/cli";
import { PARE_VIA_B } from "@/cli/via-b";
import { ENCABEZADO_CSV_SERIES, MAX_BYTES_CSV_SERIES } from "@/datos-oficiales/series/csv-series";

const SCRIPT = "importar-series.ts";
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test", "4613.27", "9.37", "carpeta-ficticia"];
const USO = "Uso: npx tsx scripts/importar-series.ts --archivo <series.csv>";
const carpeta = mkdtempSync(join(tmpdir(), "inv008-carpeta-ficticia-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

const archivo = (nombre: string, contenido: string | Uint8Array) => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};
const local = (extra: Record<string, string> = {}) => entornoMinimo({ DATABASE_URL: INALCANZABLE, ...extra });
const prod = (): NodeJS.ProcessEnv => ({ ...local(), NODE_ENV: "production" });
const sinBase = (texto: string) => expect(texto, "no debía tocar la base").not.toContain("PrismaClient");

describe("importar-series · como proceso, sin base", { timeout: 10 * POR_CLI_MS }, () => {
  it("argumentos inválidos (ninguno, --ayuda, posicional, --archivo sin ruta): 2 con su uso, sin tocar la base", () => {
    for (const args of [[], ["--ayuda"], [join(carpeta, "x.csv")], ["--archivo"]]) {
      const s = correr(SCRIPT, args, local());
      comprobar(s, 2, USO, NUNCA);
      sinBase(s.texto);
    }
  });

  it("npm se quedó con --archivo: 2", () => {
    comprobar(correr(SCRIPT, [], local({ npm_config_archivo: join(carpeta, "x.csv") })), 2, "npm se quedó con --archivo", NUNCA);
  });

  it("archivo inexistente o que no es regular: 2 con su código, sin la ruta", () => {
    comprobar(correr(SCRIPT, ["--archivo", join(carpeta, "no-existe.csv")], local()), 2, "ARCHIVO_ILEGIBLE", NUNCA);
    comprobar(correr(SCRIPT, ["--archivo", carpeta], local()), 2, "ARCHIVO_NO_REGULAR", NUNCA);
  });

  it(`más de ${MAX_BYTES_CSV_SERIES} bytes: 1 CSV_DEMASIADO_GRANDE`, () => {
    comprobar(correr(SCRIPT, ["--archivo", archivo("grande.ficticio.csv", new Uint8Array(MAX_BYTES_CSV_SERIES + 1).fill(0x41))], local()), 1, "CSV_DEMASIADO_GRANDE", NUNCA);
  });

  it("CSV inválido: 1 con línea y código, sin abrir la base y sin repetir valores", () => {
    const ruta = archivo("malo.ficticio.csv", `${ENCABEZADO_CSV_SERIES}\nTRM,2021-03-05,2021-03-07,4613.27,sfc:32sa-8pi3\nTRM,2021-03-07,2021-03-07,4613.27,sfc:32sa-8pi3\n`);
    const s = correr(SCRIPT, ["--archivo", ruta], local());
    comprobar(s, 1, "línea 3 · SOLAPE", NUNCA);
    sinBase(s.texto);
  });

  it("CSV válido con la base inalcanzable: 1 con solo el nombre del error", () => {
    const ruta = archivo("bueno.ficticio.csv", `${ENCABEZADO_CSV_SERIES}\nTPM,2021-03-08,2021-03-08,9.37,banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA\n`);
    comprobar(correr(SCRIPT, ["--archivo", ruta], local()), 1, "❌ La importación de series falló: PrismaClientInitializationError", NUNCA);
  });

  it("en producción todo fallo termina con PARE_VIA_B (uso, archivo, CSV y base)", () => {
    const valido = archivo("prod.ficticio.csv", `${ENCABEZADO_CSV_SERIES}\nTPM,2021-03-08,2021-03-08,9.37,banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA\n`);
    const malo = archivo("prod-malo.ficticio.csv", `${ENCABEZADO_CSV_SERIES}\nUVR,2021-03-08,2021-03-08,9.37,sfc:32sa-8pi3\n`);
    for (const [args, codigo] of [[[], 2], [["--archivo", carpeta], 2], [["--archivo", malo], 1], [["--archivo", valido], 1]] as const) {
      const s = correr(SCRIPT, args, prod());
      comprobar(s, codigo, PARE_VIA_B, NUNCA);
      expect(s.texto.trimEnd().endsWith(PARE_VIA_B), s.texto).toBe(true);
    }
  });
});
