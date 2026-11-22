// Series de BanRep (C2c): salen del catálogo (una sola fuente de verdad: `fuente` = banrep:<DF>.<SUBJECT>.<UNIT>), con la
// URL pública del SDMX. Un catálogo con una fuente de BanRep mal formada falla cerrado: nunca se adivina qué pedir.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { URL_BASE_BANREP, serieBanrep, seriesBanrep, urlBanrep } from "@/datos-oficiales/fuentes/banrep-series";

const RAIZ = path.join(__dirname, "..", "..", "..");
const conFuente = (fuente: string): readonly SerieCatalogo[] => [{ ...CATALOGO[1]!, codigo: "FICT_TASA", fuente }];

describe("seriesBanrep · desde el catálogo", () => {
  it("del catálogo de 008 salen exactamente la TPM y la IBR_3M_EA, con su dataflow, SUBJECT y UNIT_MEASURE", () => {
    const r = seriesBanrep();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.series.map((s) => [s.codigo, s.dataflow, s.sujeto, s.unidad])).toEqual([
      ["TPM", "DF_CBR_DAILY_HIST", "IRCBRM01", "PA"],
      ["IBR_3M_EA", "DF_IBR_DAILY_HIST", "IRIBRM03", "ER"],
    ]);
    expect(r.series.map((s) => s.catalogo.fuente)).toEqual(["banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER"]);
    expect(Object.isFrozen(r.series)).toBe(true);
    expect(r.series.every((s) => Object.isFrozen(s))).toBe(true);
  });

  it("la TRM y el IPC no son de BanRep", () => {
    expect(serieBanrep("TRM")).toBeUndefined();
    expect(serieBanrep("IPC_INDICE")).toBeUndefined();
    expect(serieBanrep("tpm")).toBeUndefined();
    expect(serieBanrep("TPM")?.dataflow).toBe("DF_CBR_DAILY_HIST");
  });

  it.each([
    "banrep:DF_CBR_DAILY_HIST.IRCBRM01",
    "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA.X",
    "banrep:df_cbr_daily_hist.IRCBRM01.PA",
    "banrep:DF_CBR/DAILY.IRCBRM01.PA",
    "banrep:DF_CBR_DAILY_HIST.IRCBRM01.P?A",
    "banrep:DF_CBR_DAILY_HIST.IRC BRM01.PA",
    "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA&x=1",
    "banrep:CBR_DAILY_HIST.IRCBRM01.PA",
    "banrep:",
  ])("una fuente de BanRep mal formada (%s) deja el catálogo entero inválido", (fuente) => {
    expect(seriesBanrep(conFuente(fuente))).toEqual({ ok: false, codigo: "BANREP_CATALOGO_INVALIDO" });
    expect(serieBanrep("FICT_TASA", conFuente(fuente))).toBeUndefined();
  });

  it("una fuente que no es de BanRep no cuenta (otro catálogo inyectado)", () => {
    const r = seriesBanrep(conFuente("dane:FICT"));
    expect(r).toEqual({ ok: true, series: [] });
  });
});

describe("urlBanrep", () => {
  it("la URL pública del SDMX, con el año de --desde en startPeriod (sin la clave de la serie: se elige en el XML)", () => {
    const tpm = serieBanrep("TPM")!;
    const ibr = serieBanrep("IBR_3M_EA")!;
    expect(URL_BASE_BANREP).toBe("https://totoro.banrep.gov.co/nsi-jax-ws/rest/data");
    expect(urlBanrep(tpm, new Date(Date.UTC(2019, 0, 1)))).toBe("https://totoro.banrep.gov.co/nsi-jax-ws/rest/data/ESTAT,DF_CBR_DAILY_HIST,1.0/all/ALL/?startPeriod=2019");
    expect(urlBanrep(ibr, new Date(Date.UTC(2021, 11, 31)))).toBe("https://totoro.banrep.gov.co/nsi-jax-ws/rest/data/ESTAT,DF_IBR_DAILY_HIST,1.0/all/ALL/?startPeriod=2021");
  });

  it("el módulo no importa el lector XML (argumentos y reporte lo usan sin arrastrarlo)", () => {
    const codigo = readFileSync(path.join(RAIZ, "src", "datos-oficiales", "fuentes", "banrep-series.ts"), "utf8");
    expect(codigo).not.toMatch(/xml-acotado|http-acotado/);
  });
});
