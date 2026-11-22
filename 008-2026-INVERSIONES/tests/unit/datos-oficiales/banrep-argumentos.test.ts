// Argumentos de scripts/exportar-banrep.ts (el Mac, con red o con --archivo): estrictos, se leen antes de pedir nada o
// de abrir el archivo, y los mensajes nunca repiten rutas, fechas ni el valor de --serie. Fechas de 2027 con `hoy` inyectado.
import { describe, expect, it } from "vitest";
import { MAX_DIAS_RANGO_BANREP, USO_EXPORTAR_BANREP, leerArgumentosExportarBanrep } from "@/datos-oficiales/fuentes/banrep-argumentos";
import { serieBanrep, seriesBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { ErrorArgumentosCarga } from "@/precios/argumentos-carga";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2027-04-13");
const RUTA = "/carpeta-ficticia/descarga.xml";
const SERIES = (() => {
  const r = seriesBanrep();
  if (!r.ok) throw new Error("el catálogo de 008 debía tener series de BanRep");
  return r.series;
})();
const leer = (argv: string[], entorno: Record<string, string> = {}) => leerArgumentosExportarBanrep(argv, entorno, HOY, SERIES);

function mensaje(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorArgumentosCarga);
    return (e as Error).message;
  }
  throw new Error("no lanzó");
}

describe("exportar-banrep · argumentos válidos", () => {
  it("--serie y --desde; --hasta por defecto hoy; sin --archivo va a la red", () => {
    expect(leer(["--serie", "TPM", "--desde", "2027-03-01"])).toEqual({ serie: serieBanrep("TPM"), desde: dia("2027-03-01"), hasta: HOY, archivo: null });
  });

  it("con --hasta y --archivo, en cualquier orden", () => {
    expect(leer(["--archivo", RUTA, "--hasta", "2027-03-31", "--serie", "IBR_3M_EA", "--desde", "2027-03-01"])).toEqual({
      serie: serieBanrep("IBR_3M_EA"), desde: dia("2027-03-01"), hasta: dia("2027-03-31"), archivo: RUTA,
    });
  });

  it(`acepta un rango de ${MAX_DIAS_RANGO_BANREP} días exactos (y hasta = desde)`, () => {
    expect(MAX_DIAS_RANGO_BANREP).toBe(1830);
    const desde = new Date(HOY.getTime() - MAX_DIAS_RANGO_BANREP * 86_400_000).toISOString().slice(0, 10);
    expect(leer(["--serie", "TPM", "--desde", desde]).desde).toEqual(dia(desde));
    expect(leer(["--serie", "TPM", "--desde", "2027-04-13", "--hasta", "2027-04-13"]).hasta).toEqual(HOY);
  });
});

describe("exportar-banrep · argumentos inválidos", () => {
  it.each([
    [[], "Falta --serie"],
    [["--desde", "2027-03-01"], "Falta --serie"],
    [["--serie", "TPM"], "Falta --desde"],
    [["--serie", "TRM", "--desde", "2027-03-01"], "--serie debe ser TPM o IBR_3M_EA"],
    [["--serie", "IPC_INDICE", "--desde", "2027-03-01"], "--serie debe ser TPM o IBR_3M_EA"],
    [["--serie", "tpm", "--desde", "2027-03-01"], "--serie debe ser TPM o IBR_3M_EA"],
    [["--serie", "TPM", "--desde", "2027-02-30"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    [["--serie", "TPM", "--desde", " 2027-03-01"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    [["--serie", "TPM", "--desde", "2027-03-10", "--hasta", "2027-03-09"], "Rango inválido"],
    [["--serie", "TPM", "--desde", "2027-03-10", "--hasta", "2027-04-14"], "Rango inválido"],
    [["--serie", "TPM", "--desde", "2022-04-08"], `más de ${MAX_DIAS_RANGO_BANREP} días`],
    [["--serie", "TPM", "--desde", "2027-03-01", "--serie", "TPM"], "--serie está repetida"],
    [["--serie", "TPM", "--desde", "2027-03-01", "--archivo"], "--archivo necesita una ruta"],
    [["--serie", "TPM", "--desde", "2027-03-01", "--archivo", "-x"], "--archivo necesita una ruta"],
    [["--serie", "TPM", "--desde", "2027-03-01", RUTA], "Argumento suelto"],
    [["--serie=TPM", "--desde", "2027-03-01"], "Opción desconocida: «--serie»"],
    [["--serie", "TPM", "--desde", "2027-03-01", "--", RUTA], "Opción desconocida"],
    [["--serie", "TPM", "--desde", "2027-03-01", "--nemos", RUTA], "Opción desconocida: «--nemos»"],
    [["--ayuda"], "Opción desconocida: «--ayuda»"],
  ])("rechaza %j", (argv, esperado) => {
    const m = mensaje(() => leer(argv));
    expect(m).toContain(esperado);
    expect(m).not.toMatch(/carpeta-ficticia|2027-0|2022-04|tpm\b|TRM|IPC_INDICE/);
  });

  it.each(["--serie", "--desde", "--hasta", "--archivo"])("npm se quedó con %s (sin «--»): lo dice", (opcion) => {
    const variable = `npm_config_${opcion.slice(2)}`;
    expect(mensaje(() => leer([], { [variable]: "x" }))).toContain(`npm se quedó con ${opcion}`);
  });

  it("si la opción sí llegó, la variable de npm no estorba", () => {
    expect(leer(["--serie", "TPM", "--desde", "2027-03-01"], { npm_config_serie: "x" }).serie.codigo).toBe("TPM");
  });

  it("el uso nombra el comando, las dos series, --archivo y las salidas", () => {
    expect(USO_EXPORTAR_BANREP).toContain("npx tsx scripts/exportar-banrep.ts --serie <TPM|IBR_3M_EA> --desde AAAA-MM-DD");
    expect(USO_EXPORTAR_BANREP).toContain("--archivo");
    expect(USO_EXPORTAR_BANREP).toContain("Salida: 0");
  });
});
