// Exportar una serie de BanRep (C2c) y su reporte: el mismo lector para la red y para --archivo, el CSV canónico con la
// fuente del catálogo (escribirCsvSeries lo vuelve a leer), avisos (descartes, serie atrasada, días faltantes de la TPM)
// y la indicación de bajar el XML en el navegador cuando BanRep no lo entrega. Por stderr solo conteos, códigos, fechas
// del pedido y de la serie (públicas) y la URL pública: nunca valores ni rutas. Sin red; cifras y fechas inventadas.
import { describe, expect, it } from "vitest";
import { serieBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { exportarBanrep, type OrigenBanrep } from "@/datos-oficiales/fuentes/banrep-exportar";
import { reporteArchivoBanrep, reporteExportacionBanrep } from "@/datos-oficiales/fuentes/banrep-reporte";
import type { BuscarHttp } from "@/lib/http-acotado";
import { CAPTCHA_FICTICIO, MENSAJE_IBR, MENSAJE_TPM, SERIE_TPM, bytesDe, utf8, type ObsFicticia } from "./banrep.ficticio";

const TPM = serieBanrep("TPM")!;
const IBR = serieBanrep("IBR_3M_EA")!;
const HOY = new Date(Date.UTC(2027, 3, 13));
const dia = (d: number) => new Date(Date.UTC(2027, 2, d));
const URL_TPM = "https://totoro.banrep.gov.co/nsi-jax-ws/rest/data/ESTAT,DF_CBR_DAILY_HIST,1.0/all/ALL/?startPeriod=2027";
const FUENTE_TPM = "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA";
const NUNCA = ["7.31", "7.29", "13.47", "6.913", "12.437", "carpeta-ficticia", "FICTMARCA"];

const archivo = (bytes: Uint8Array): OrigenBanrep => ({ tipo: "ARCHIVO", bytes });
const red = (buscar: BuscarHttp): OrigenBanrep => ({ tipo: "RED", buscar });
const xml = (bytes: Uint8Array): BuscarHttp => async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "application/xml" } });
const nuncaPide: BuscarHttp = async () => {
  throw new Error("con --archivo no se pide nada a BanRep");
};
const tpmCon = (obs: readonly ObsFicticia[]) => bytesDe({ ...MENSAJE_TPM, series: [{ ...SERIE_TPM, obs }] });
const exportar = (origen: OrigenBanrep, serie = TPM, desde = dia(1), hasta = dia(19)) => exportarBanrep({ serie, desde, hasta, hoy: HOY, origen });

function sinDatos(lineas: readonly string[]): void {
  const texto = lineas.join("\n");
  for (const dato of NUNCA) expect(texto, dato).not.toContain(dato);
}

describe("exportarBanrep · lo que sale bien", () => {
  it("por la red: el CSV exacto, con la fuente del catálogo, y salida 0", async () => {
    const r = await exportar(red(xml(bytesDe(MENSAJE_TPM))));
    expect(r.csv).toBe([
      "serie,desde,hasta,valor,fuente",
      `TPM,2027-03-17,2027-03-17,7.31,${FUENTE_TPM}`,
      `TPM,2027-03-18,2027-03-18,7.29,${FUENTE_TPM}`,
      `TPM,2027-03-19,2027-03-19,13.47,${FUENTE_TPM}`,
      "",
    ].join("\n"));
    expect(r).toMatchObject({ serie: "TPM", origen: "RED", url: URL_TPM, filas: 3, fallo: null, codigoCsv: null, primerDia: dia(17), ultimoDia: dia(19), diasFaltantes: 0, atrasada: false });
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(0);
    expect(reporte.lineas[0]).toBe("✅ TPM · BanRep (red) · observaciones de la serie en el XML: 3 · filas en el CSV: 3 · del 2027-03-17 al 2027-03-19 · fuera del rango pedido: 0");
    sinDatos(reporte.lineas);
  });

  it("con --archivo: el mismo lector y nunca pide a BanRep", async () => {
    const r = await exportar(archivo(bytesDe(MENSAJE_TPM)), TPM, dia(1), dia(19));
    expect(r).toMatchObject({ origen: "ARCHIVO", filas: 3, fallo: null });
    expect(reporteExportacionBanrep(r).lineas[0]).toContain("✅ TPM · archivo");
    const conDoble = await exportarBanrep({ serie: TPM, desde: dia(1), hasta: dia(19), hoy: HOY, origen: { ...archivo(bytesDe(MENSAJE_TPM)), buscar: nuncaPide } as OrigenBanrep });
    expect(conDoble.filas).toBe(3);
  });

  it("la IBR (días hábiles): un fin de semana sin valor no es un día faltante", async () => {
    const r = await exportar(archivo(bytesDe(MENSAJE_IBR)), IBR, dia(1), dia(22));
    expect(r).toMatchObject({ serie: "IBR_3M_EA", filas: 3, diasFaltantes: 0, atrasada: false });
    expect(r.csv).toContain("IBR_3M_EA,2027-03-22,2027-03-22,12.437,banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER\n");
    expect(reporteExportacionBanrep(r).codigoSalida).toBe(0);
  });
});

describe("exportarBanrep · avisos (salida 3, el CSV sale con lo demás)", () => {
  it("descartes por razón", async () => {
    const r = await exportar(archivo(tpmCon([
      { dia: "20270317", valor: "7.31" }, { dia: "20270318", valor: "7.29", estado: "P" }, { dia: "20270319", valor: null }, { dia: "20270320", valor: "7.315" },
    ])), TPM, dia(1), dia(20));
    expect(r.filas).toBe(1);
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(3);
    expect(reporte.lineas).toContain("⚠️  descartadas · no definitivas (OBS_STATUS distinto de A): 1 · sin valor: 1 · valor fuera de la escala o del rango del catálogo: 1");
    sinDatos(reporte.lineas);
  });

  it("la serie atrasada: el último valor queda más de su umbral de frescura antes de --hasta", async () => {
    const r = await exportar(archivo(bytesDe(MENSAJE_TPM)), TPM, dia(1), dia(27));
    expect(r.atrasada).toBe(true);
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(3);
    expect(reporte.lineas).toContain("⚠️  ATRASADA · el último valor es del 2027-03-19: más de 7 días antes de --hasta (2027-03-27). BanRep puede no haber publicado todavía.");
    expect((await exportar(archivo(bytesDe(MENSAJE_TPM)), TPM, dia(1), dia(26))).atrasada).toBe(false);
  });

  it("la TPM es diaria de calendario: un día que falta entre el primero y el último se avisa", async () => {
    const r = await exportar(archivo(tpmCon([{ dia: "20270317", valor: "7.31" }, { dia: "20270320", valor: "7.29" }])), TPM, dia(1), dia(20));
    expect(r.diasFaltantes).toBe(2);
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(3);
    expect(reporte.lineas).toContain("⚠️  faltan 2 día(s) entre el primero y el último: la TPM es diaria de calendario.");
  });
});

describe("exportarBanrep · fallos (salida 1, sin CSV)", () => {
  it("BanRep bloquea por la red: BANREP_BLOQUEADO, con la URL pública para bajarlo en el navegador y --archivo", async () => {
    const captcha: BuscarHttp = async () => new Response(CAPTCHA_FICTICIO, { headers: { "content-type": "text/html" } });
    const r = await exportar(red(captcha));
    expect(r).toMatchObject({ csv: null, filas: 0, fallo: { ok: false, codigo: "BANREP_BLOQUEADO", detalle: "TIPO" } });
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(1);
    const texto = reporte.lineas.join("\n");
    expect(texto).toContain("❌ BANREP_BLOQUEADO (TIPO) · BanRep no entregó el SDMX");
    expect(texto).toContain(`Abra en su navegador ${URL_TPM}`);
    expect(texto).toContain("--archivo");
    expect(texto).toContain("Nada se evade");
    sinDatos(reporte.lineas);
  });

  it("un --archivo que es la página del captcha: BANREP_BLOQUEADO (HTML), con la indicación de guardar el XML", async () => {
    const r = await exportar(archivo(utf8(CAPTCHA_FICTICIO)));
    expect(r.fallo).toEqual({ ok: false, codigo: "BANREP_BLOQUEADO", detalle: "HTML" });
    const texto = reporteExportacionBanrep(r).lineas.join("\n");
    expect(texto).toContain("guárdelo como XML");
    expect(texto).not.toContain("FICTMARCA");
  });

  it.each([
    ["la red", async () => Promise.reject(new TypeError("x")), "BANREP_RED"],
    ["un 500", async () => new Response("", { status: 500 }), "BANREP_HTTP_500"],
    ["un cuerpo vacío", async () => new Response("", { headers: { "content-type": "application/xml" } }), "BANREP_FORMATO"],
  ] as const)("%s: su código, la URL y --archivo", async (_caso, buscar, codigo) => {
    const r = await exportar(red(buscar as BuscarHttp));
    expect(r.fallo?.codigo).toBe(codigo);
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(1);
    expect(reporte.lineas.join("\n")).toContain(`❌ ${codigo}`);
    expect(reporte.lineas.join("\n")).toContain("--archivo");
  });

  it("lo estructural del XML (otro dataflow): su código y la explicación, salida 1", async () => {
    const r = await exportar(archivo(bytesDe(MENSAJE_IBR)), TPM);
    expect(r.fallo?.codigo).toBe("BANREP_OTRO_DATAFLOW");
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(1);
    expect(reporte.lineas.join("\n")).toContain("❌ BANREP_OTRO_DATAFLOW · el XML es de otro dataflow");
  });

  it("sin valores en el rango: SIN_FILAS, salida 1", async () => {
    const r = await exportar(archivo(bytesDe(MENSAJE_TPM)), TPM, dia(1), dia(16));
    expect(r).toMatchObject({ csv: null, filas: 0, codigoCsv: "SIN_FILAS", fallo: null });
    const reporte = reporteExportacionBanrep(r);
    expect(reporte.codigoSalida).toBe(1);
    expect(reporte.lineas).toContain("❌ SIN_FILAS · no se escribió el CSV (no hay valores de la serie en el rango pedido).");
  });

  it("todo descartado: SIN_FILAS (1) gana sobre los avisos (3)", async () => {
    const r = await exportar(archivo(tpmCon([{ dia: "20270317", valor: "7.31", estado: "P" }])));
    expect(reporteExportacionBanrep(r).codigoSalida).toBe(1);
  });

  it("una fila que el importador rechazaría (fecha futura frente a hoy): FILA_INVALIDA, salida 1", async () => {
    const r = await exportarBanrep({ serie: TPM, desde: dia(1), hasta: dia(19), hoy: dia(18), origen: archivo(bytesDe(MENSAJE_TPM)) });
    expect(r).toMatchObject({ csv: null, codigoCsv: "FILA_INVALIDA" });
    expect(reporteExportacionBanrep(r).codigoSalida).toBe(1);
  });
});

describe("reporteArchivoBanrep · el --archivo no se pudo leer", () => {
  it("ilegible o no regular: 2; demasiado grande: 1, con la indicación de un --desde más reciente; nunca la ruta", () => {
    expect(reporteArchivoBanrep("ARCHIVO_ILEGIBLE").codigoSalida).toBe(2);
    expect(reporteArchivoBanrep("ARCHIVO_NO_REGULAR").codigoSalida).toBe(2);
    const grande = reporteArchivoBanrep("ARCHIVO_DEMASIADO_GRANDE");
    expect(grande.codigoSalida).toBe(1);
    expect(grande.lineas.join("\n")).toContain("startPeriod más reciente");
    for (const c of ["ARCHIVO_ILEGIBLE", "ARCHIVO_NO_REGULAR", "ARCHIVO_DEMASIADO_GRANDE"] as const) {
      expect(reporteArchivoBanrep(c).lineas[0]).toMatch(new RegExp(`^❌ ${c} · `));
    }
  });
});
