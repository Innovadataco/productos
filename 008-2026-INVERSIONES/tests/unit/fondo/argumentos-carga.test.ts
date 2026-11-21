// Argumentos de scripts/importar-valores-fondo.ts (producción, sin red) y scripts/exportar-valores-fondo.ts (el Mac,
// con red): estrictos, se leen antes de abrir la base o la red, y los mensajes nunca repiten rutas ni fechas.
import { describe, expect, it } from "vitest";
import {
  MAX_DIAS_RANGO_FONDO, USO_EXPORTAR_VALORES_FONDO, USO_IMPORTAR_VALORES_FONDO, leerArgumentosExportarValoresFondo, leerArgumentosImportarValoresFondo,
} from "@/fondo/argumentos-carga";
import { MAX_BYTES_CSV_FONDO, MAX_FILAS_CSV_FONDO, MAX_FONDOS_CSV, MAX_LARGO_LINEA_FONDO } from "@/fondo/csv-valores";
import { LIMITE_FILAS } from "@/fondo/sfc";
import { ErrorArgumentosCarga } from "@/precios/argumentos-carga";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2024-03-15");
const RUTA = "/carpeta-ficticia/valores.csv";
const exportar = (argv: string[], entorno: Record<string, string> = {}) => leerArgumentosExportarValoresFondo(argv, entorno, HOY);

function mensaje(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorArgumentosCarga);
    return (e as Error).message;
  }
  throw new Error("no lanzó");
}

describe("importar-valores-fondo · --archivo", () => {
  it("lee --archivo", () => {
    expect(leerArgumentosImportarValoresFondo(["--archivo", RUTA], {})).toEqual({ archivo: RUTA });
  });

  it.each([
    [[], "Falta --archivo"],
    [["--archivo"], "--archivo necesita una ruta"],
    [["--archivo", "-x"], "--archivo necesita una ruta"],
    [["--archivo", RUTA, "--archivo", RUTA], "--archivo está repetida"],
    [[RUTA], "Argumento suelto"],
    [[`--archivo=${RUTA}`], "Opción desconocida"],
    [["--fondos", RUTA], "Opción desconocida: «--fondos»"],
  ])("rechaza %j", (argv, esperado) => {
    const m = mensaje(() => leerArgumentosImportarValoresFondo(argv, {}));
    expect(m).toContain(esperado);
    expect(m).not.toContain("carpeta-ficticia");
  });

  it("npm se quedó con --archivo (sin «--»): lo dice", () => {
    expect(mensaje(() => leerArgumentosImportarValoresFondo([], { npm_config_archivo: RUTA }))).toContain("npm se quedó con --archivo");
  });

  it("el uso nombra el comando npm con -s", () => {
    expect(USO_IMPORTAR_VALORES_FONDO).toContain("npm run -s fondo:importar -- --archivo");
  });
});

describe("fondo:exportar · --fondos, --desde y --hasta", () => {
  it("--hasta por defecto es hoy", () => {
    expect(exportar(["--fondos", RUTA, "--desde", "2024-03-01"])).toEqual({ fondos: RUTA, desde: dia("2024-03-01"), hasta: HOY });
  });

  it(`acepta un rango de ${MAX_DIAS_RANGO_FONDO} días exactos`, () => {
    const desde = new Date(HOY.getTime() - MAX_DIAS_RANGO_FONDO * 86_400_000).toISOString().slice(0, 10);
    expect(exportar(["--fondos", RUTA, "--desde", desde]).desde).toEqual(dia(desde));
  });

  it.each([
    [["--desde", "2024-03-01"], "Falta --fondos"],
    [["--fondos", RUTA], "Falta --desde"],
    [["--fondos", RUTA, "--desde", "2024-02-30"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    [["--fondos", RUTA, "--desde", " 2024-03-01"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    [["--fondos", RUTA, "--desde", "2024-03-10", "--hasta", "2024-03-09"], "Rango inválido"],
    [["--fondos", RUTA, "--desde", "2024-03-10", "--hasta", "2024-03-16"], "Rango inválido"],
    [["--fondos", RUTA, "--desde", "2019-01-01"], `más de ${MAX_DIAS_RANGO_FONDO} días`],
    [["--fondos", RUTA, "--desde", "2024-03-01", "--nemos", RUTA], "Opción desconocida: «--nemos»"],
  ])("rechaza %j", (argv, esperado) => {
    const m = mensaje(() => exportar(argv));
    expect(m).toContain(esperado);
    expect(m).not.toMatch(/carpeta-ficticia|2024-03|2019/);
  });

  it("npm se quedó con --hasta (sin «--»): lo dice", () => {
    expect(mensaje(() => exportar(["--fondos", RUTA, "--desde", "2024-03-01"], { npm_config_hasta: "2024-03-10" }))).toContain("npm se quedó con --hasta");
  });

  it("el uso nombra el comando npm con -s y la salida a un .parcial", () => {
    expect(USO_EXPORTAR_VALORES_FONDO).toContain("npm run -s fondo:exportar -- --fondos <lista.txt> --desde AAAA-MM-DD");
    expect(USO_EXPORTAR_VALORES_FONDO).toContain(".parcial");
  });
});

describe("el rango máximo cabe en los topes", () => {
  it(`${MAX_FONDOS_CSV} fondos × (${MAX_DIAS_RANGO_FONDO} + 1) días caben en el CSV, y un fondo en una consulta a la SFC`, () => {
    expect(MAX_FONDOS_CSV * (MAX_DIAS_RANGO_FONDO + 1)).toBeLessThanOrEqual(MAX_FILAS_CSV_FONDO);
    expect(MAX_FILAS_CSV_FONDO * (MAX_LARGO_LINEA_FONDO + 1)).toBeLessThan(MAX_BYTES_CSV_FONDO);
    expect(MAX_DIAS_RANGO_FONDO + 1).toBeLessThan(LIMITE_FILAS);
  });
});
