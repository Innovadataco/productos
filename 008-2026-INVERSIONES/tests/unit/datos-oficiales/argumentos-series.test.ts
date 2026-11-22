// Argumentos de scripts/importar-series.ts (producción por la vía B, sin red; o el Mac): solo `--archivo <ruta>`,
// estrictos, leídos antes de abrir el archivo o la base, y los mensajes nunca repiten rutas.
import { describe, expect, it } from "vitest";
import { USO_IMPORTAR_SERIES, leerArgumentosImportarSeries } from "@/datos-oficiales/series/argumentos";
import { MAX_BYTES_CSV_SERIES, MAX_FILAS_CSV_SERIES, MAX_SERIES_CSV } from "@/datos-oficiales/series/csv-series";
import { ErrorArgumentosCarga } from "@/precios/argumentos-carga";

const RUTA = "/carpeta-ficticia/series.ficticio.csv";

function mensaje(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorArgumentosCarga);
    return (e as Error).message;
  }
  throw new Error("no lanzó");
}

describe("importar-series · --archivo", () => {
  it("lee --archivo", () => {
    expect(leerArgumentosImportarSeries(["--archivo", RUTA], {})).toEqual({ archivo: RUTA });
  });

  it.each([
    [[], "Falta --archivo <series.csv>."],
    [["--archivo"], "--archivo necesita una ruta"],
    [["--archivo", "-x"], "--archivo necesita una ruta"],
    [["--archivo", RUTA, "--archivo", RUTA], "--archivo está repetida"],
    [[RUTA], "Argumento suelto"],
    [[`--archivo=${RUTA}`], "Opción desconocida: «--archivo»."],
    [["--ayuda"], "Opción desconocida: «--ayuda»."],
    [["--"], "Opción desconocida."],
    [["--ARCHIVO", RUTA], "Opción desconocida."],
    [["--archivo\u0007", RUTA], "Opción desconocida."],
  ])("rechaza %j", (argv, esperado) => {
    const m = mensaje(() => leerArgumentosImportarSeries(argv, {}));
    expect(m).toContain(esperado);
    expect(m).not.toContain("carpeta-ficticia");
  });

  it("npm se quedó con --archivo (sin «--»): lo dice; si la opción sí llegó, no estorba", () => {
    expect(mensaje(() => leerArgumentosImportarSeries([], { npm_config_archivo: RUTA }))).toContain("npm se quedó con --archivo");
    expect(leerArgumentosImportarSeries(["--archivo", RUTA], { npm_config_archivo: RUTA })).toEqual({ archivo: RUTA });
  });

  it("el uso dice el comando, el formato, los topes y las salidas", () => {
    expect(USO_IMPORTAR_SERIES).toContain("npx tsx scripts/importar-series.ts --archivo <series.csv>");
    expect(USO_IMPORTAR_SERIES).toContain("src/datos-oficiales/series/csv-series.ts");
    expect(USO_IMPORTAR_SERIES).toContain(`${MAX_BYTES_CSV_SERIES} bytes, ${MAX_FILAS_CSV_SERIES} filas y ${MAX_SERIES_CSV} series`);
    expect(USO_IMPORTAR_SERIES).toContain("Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.");
  });
});
