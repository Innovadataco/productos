// Argumentos de `precios:importar` (producción) y `precios:exportar` (Mac): estrictos, se leen ANTES de abrir la
// base o la red, y los mensajes nunca repiten una ruta ni una fecha (a lo sumo el nombre de una opción). Datos inventados.
import { describe, expect, it } from "vitest";
import {
  ErrorArgumentosCarga, MAX_DIAS_RANGO, leerArgumentosExportarPrecios, leerArgumentosImportarPrecios,
} from "@/precios/argumentos-carga";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = utc("2024-03-15");
const RUTA = "/carpeta-ficticia/precios-ficticios.csv";

function mensajeDe(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArgumentosCarga) return e.message;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("leerArgumentosImportarPrecios", () => {
  const leer = (argv: string[], entorno: Record<string, string> = {}) => leerArgumentosImportarPrecios(argv, entorno);

  it("--archivo <ruta>, una vez", () => {
    expect(leer(["--archivo", RUTA])).toEqual({ archivo: RUTA });
  });

  it.each([
    ["sin argumentos", [], "Falta --archivo"],
    ["--archivo sin valor", ["--archivo"], "--archivo necesita una ruta"],
    ["--archivo con una opción como valor", ["--archivo", "--otra"], "--archivo necesita una ruta"],
    ["--archivo con un valor que empieza por «-»", ["--archivo", "-x.csv"], "--archivo necesita una ruta"],
    ["--archivo repetido", ["--archivo", RUTA, "--archivo", RUTA], "--archivo está repetida"],
    ["una opción desconocida", ["--ayuda"], "Opción desconocida: «--ayuda»."],
    ["--archivo=<ruta> (forma no admitida)", [`--archivo=${RUTA}`], "Opción desconocida: «--archivo»."],
    ["una posicional", [RUTA], "no se admiten argumentos sueltos"],
  ])("%s: error de uso, sin repetir la ruta", (_n, argv, esperado) => {
    const m = mensajeDe(() => leer(argv));
    expect(m).toContain(esperado);
    expect(m).not.toContain("ficticio");
  });

  it("una opción con caracteres raros no se repite", () => {
    expect(mensajeDe(() => leer(["--a\u001b[2Jb"]))).toBe("Opción desconocida.");
  });

  it("si npm se quedó con --archivo (npm run sin «--»), lo dice y no sigue", () => {
    expect(mensajeDe(() => leer([], { npm_config_archivo: RUTA }))).toContain("npm se quedó con --archivo");
    expect(leer(["--archivo", RUTA], { npm_config_archivo: RUTA })).toEqual({ archivo: RUTA });
  });
});

describe("leerArgumentosExportarPrecios", () => {
  const leer = (argv: string[], entorno: Record<string, string> = {}) => leerArgumentosExportarPrecios(argv, entorno, HOY);

  it("--nemos y --desde; --hasta por defecto es hoy", () => {
    expect(leer(["--nemos", RUTA, "--desde", "2024-03-01"])).toEqual({ nemos: RUTA, desde: utc("2024-03-01"), hasta: HOY });
    expect(leer(["--desde", "2024-03-01", "--hasta", "2024-03-08", "--nemos", RUTA])).toEqual({ nemos: RUTA, desde: utc("2024-03-01"), hasta: utc("2024-03-08") });
  });

  it(`un rango de un día y uno de ${MAX_DIAS_RANGO} días pasan`, () => {
    expect(leer(["--nemos", RUTA, "--desde", "2024-03-15"]).desde).toEqual(HOY);
    const desde = new Date(HOY.getTime() - MAX_DIAS_RANGO * 86_400_000).toISOString().slice(0, 10);
    expect(leer(["--nemos", RUTA, "--desde", desde]).desde).toEqual(utc(desde));
  });

  it.each([
    ["sin --nemos", ["--desde", "2024-03-01"], "Falta --nemos"],
    ["sin --desde", ["--nemos", RUTA], "Falta --desde"],
    ["fecha imposible", ["--nemos", RUTA, "--desde", "2024-02-30"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    ["fecha sin ceros", ["--nemos", RUTA, "--desde", "2024-3-1"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    ["fecha con espacio", ["--nemos", RUTA, "--desde", " 2024-03-01"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    ["desde después de hasta", ["--nemos", RUTA, "--desde", "2024-03-10", "--hasta", "2024-03-09"], "Rango inválido"],
    ["hasta en el futuro", ["--nemos", RUTA, "--desde", "2024-03-10", "--hasta", "2024-03-16"], "Rango inválido"],
    ["rango de más días que el tope", ["--nemos", RUTA, "--desde", new Date(HOY.getTime() - (MAX_DIAS_RANGO + 1) * 86_400_000).toISOString().slice(0, 10)], `más de ${MAX_DIAS_RANGO} días`],
    ["--desde repetida", ["--nemos", RUTA, "--desde", "2024-03-01", "--desde", "2024-03-02"], "--desde está repetida"],
    ["--nemos sin valor", ["--desde", "2024-03-01", "--nemos"], "--nemos necesita una ruta"],
    ["una posicional", ["--nemos", RUTA, "--desde", "2024-03-01", "otra"], "no se admiten argumentos sueltos"],
    ["una opción desconocida", ["--nemos", RUTA, "--desde", "2024-03-01", "--salida", "x"], "Opción desconocida: «--salida»."],
  ])("%s: error de uso, sin repetir la ruta ni la fecha", (_n, argv, esperado) => {
    const m = mensajeDe(() => leer(argv));
    expect(m).toContain(esperado);
    expect(m).not.toMatch(/ficticio|2024-/);
  });

  it("si npm se quedó con --hasta (cambiaría el rango en silencio), lo dice y no sigue", () => {
    expect(mensajeDe(() => leer(["--nemos", RUTA, "--desde", "2024-03-01"], { npm_config_hasta: "2024-03-02" }))).toContain("npm se quedó con --hasta");
  });
});
