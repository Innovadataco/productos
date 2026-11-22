// Observaciones del SDMX de BanRep (C2c): fecha AAAAMMDD estricta, valor como texto decimal canónico (nunca Number ni
// redondeo), escala y rango del catálogo, OBS_STATUS = A, duplicados y rango pedido. Lo que no sirve como dato se
// descarta y se cuenta por razón; lo que rompe la forma falla cerrado. Ida y vuelta con el CSV canónico. Cifras inventadas.
import { describe, expect, it } from "vitest";
import { serieBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { leerSdmxBanrep } from "@/datos-oficiales/fuentes/banrep-sdmx";
import { escribirCsvSeries, leerCsvSeries } from "@/datos-oficiales/series/csv-series";
import { MENSAJE_IBR, MENSAJE_TPM, SERIE_TPM, bytesDe, seriesIbr, type ObsFicticia } from "./banrep.ficticio";

const TPM = serieBanrep("TPM")!;
const IBR = serieBanrep("IBR_3M_EA")!;
const DESDE = new Date(Date.UTC(2027, 2, 1));
const HASTA = new Date(Date.UTC(2027, 2, 31));
const HOY = new Date(Date.UTC(2027, 3, 13));
const dia = (d: number) => new Date(Date.UTC(2027, 2, d));

const tpm = (obs: readonly ObsFicticia[], desde = DESDE, hasta = HASTA) => leerSdmxBanrep(bytesDe({ ...MENSAJE_TPM, series: [{ ...SERIE_TPM, obs }] }), TPM, desde, hasta);
const ibr = (er: readonly ObsFicticia[]) => leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: seriesIbr(er, []) }), IBR, DESDE, HASTA);
const valores = (r: ReturnType<typeof tpm>) => (r.ok ? r.valores.map((v) => v.valor) : r.codigo);
const conteos = (r: ReturnType<typeof tpm>) => (r.ok ? r.conteos : null);
const uno = (valor: string | null, estado: string | null = "A"): ObsFicticia[] => [{ dia: "20270317", valor, estado }];

describe("observaciones · valor", () => {
  it("se canoniza como texto: ceros sobrantes fuera", () => {
    expect(valores(tpm([{ dia: "20270317", valor: "07.310" }, { dia: "20270318", valor: "9.10" }, { dia: "20270319", valor: "13" }]))).toEqual(["7.31", "9.1", "13"]);
  });

  it("la escala se mide sobre el canónico: 6.9130 cabe en la IBR (3); 7.315 no cabe en la TPM (2) y se descarta sin redondear", () => {
    expect(valores(ibr([{ dia: "20270317", valor: "6.9130" }]))).toEqual(["6.913"]);
    const r = tpm([{ dia: "20270317", valor: "7.315" }, { dia: "20270318", valor: "7.31" }]);
    expect(valores(r)).toEqual(["7.31"]);
    expect(conteos(r)).toMatchObject({ observaciones: 2, valorInvalido: 1 });
  });

  it("el rango del catálogo, en sus bordes (0.5 y 50 entran; 0.49 y 50.01 no)", () => {
    const r = tpm([
      { dia: "20270317", valor: "0.5" }, { dia: "20270318", valor: "50" }, { dia: "20270319", valor: "0.49" }, { dia: "20270320", valor: "50.01" },
    ]);
    expect(valores(r)).toEqual(["0.5", "50"]);
    expect(conteos(r)).toMatchObject({ valorInvalido: 2 });
  });

  it.each(["NaN", "-1", "1e1", "+7", ".5", " 7.31", "7.31 ", "7,31", "", "0x7", "７.31"])("«%s» no es un decimal: se descarta y se cuenta", (v) => {
    const r = tpm([{ dia: "20270317", valor: v }, { dia: "20270318", valor: "7.29" }]);
    expect(valores(r)).toEqual(["7.29"]);
    expect(conteos(r)).toMatchObject({ valorInvalido: 1 });
  });

  it("sin ObsValue es una observación faltante: se descarta y se cuenta aparte", () => {
    const r = tpm([...uno(null), { dia: "20270318", valor: "7.29" }]);
    expect(valores(r)).toEqual(["7.29"]);
    expect(conteos(r)).toMatchObject({ sinValor: 1, valorInvalido: 0 });
  });
});

describe("observaciones · estado", () => {
  it.each([["P"], ["M"], ["E"], [null]])("OBS_STATUS %s (no definitivo o ausente): se descarta y se cuenta", (estado) => {
    const r = tpm([...uno("7.31", estado), { dia: "20270318", valor: "7.29" }]);
    expect(valores(r)).toEqual(["7.29"]);
    expect(conteos(r)).toMatchObject({ noDefinitivas: 1 });
  });

  it("dos OBS_STATUS en la misma observación: BANREP_OBS_INVALIDA", () => {
    const r = tpm([{ dia: "20270317", valor: "7.31", extra: '<generic:Attributes><generic:Value id="OBS_STATUS" value="A" /></generic:Attributes>' }]);
    expect(r).toEqual({ ok: false, codigo: "BANREP_OBS_INVALIDA", detalle: null });
  });
});

describe("observaciones · fecha y forma (fallan cerradas: BANREP_OBS_INVALIDA)", () => {
  it.each([[null], ["2027-03-17"], ["20270230"], ["18991231"], ["2027031"], ["202703170"], ["2027031a"]])("ObsDimension %s", (d) => {
    expect(tpm([{ dia: d, valor: "7.31" }])).toEqual({ ok: false, codigo: "BANREP_OBS_INVALIDA", detalle: null });
  });

  it("dos ObsValue, dos ObsDimension, un ObsValue sin value o un hijo raro", () => {
    for (const extra of ['<generic:ObsValue value="7.29" />', '<generic:ObsDimension value="20270318" />', "<generic:Fict />"]) {
      expect(tpm([{ dia: "20270317", valor: "7.31", extra }]).ok, extra).toBe(false);
    }
    expect(tpm([{ dia: "20270317", valor: null, extra: "<generic:ObsValue />" }])).toEqual({ ok: false, codigo: "BANREP_OBS_INVALIDA", detalle: null });
  });
});

describe("observaciones · duplicados", () => {
  it("la misma fecha con el mismo valor (canónico) y estado se funde", () => {
    const r = tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270317", valor: "7.310" }]);
    expect(valores(r)).toEqual(["7.31"]);
    expect(conteos(r)).toMatchObject({ observaciones: 2 });
  });

  it("la misma fecha con valores o estados distintos: BANREP_AMBIGUO, aunque uno de los dos se fuera a descartar", () => {
    expect(tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270317", valor: "7.29" }])).toEqual({ ok: false, codigo: "BANREP_AMBIGUO", detalle: null });
    expect(tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270317", valor: "7.31", estado: "P" }])).toEqual({ ok: false, codigo: "BANREP_AMBIGUO", detalle: null });
    expect(tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270317", valor: "NaN" }])).toEqual({ ok: false, codigo: "BANREP_AMBIGUO", detalle: null });
    expect(tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270317", valor: null }])).toEqual({ ok: false, codigo: "BANREP_AMBIGUO", detalle: null });
  });

  it("duplicados fuera del rango pedido también cuentan (la respuesta es una sola)", () => {
    expect(tpm([{ dia: "20270201", valor: "7.31" }, { dia: "20270201", valor: "7.29" }]).ok).toBe(false);
  });
});

describe("observaciones · rango pedido y orden", () => {
  it("lo de fuera de [desde, hasta] se cuenta aparte (informativo); la salida va ordenada por fecha", () => {
    const r = tpm([
      { dia: "20270319", valor: "13.47" }, { dia: "20270228", valor: "7.37" }, { dia: "20270317", valor: "7.31" }, { dia: "20270401", valor: "7.41" },
    ], DESDE, dia(19));
    expect(r.ok && r.valores.map((v) => v.desde)).toEqual([dia(17), dia(19)]);
    expect(conteos(r)).toEqual({ observaciones: 4, fueraDelRango: 2, noDefinitivas: 0, sinValor: 0, valorInvalido: 0 });
  });

  it("los dos bordes del rango entran", () => {
    const r = tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270319", valor: "13.47" }], dia(17), dia(19));
    expect(valores(r)).toEqual(["7.31", "13.47"]);
  });

  it("sin observaciones en el rango no es error del lector (lo dice el exportador: SIN_FILAS)", () => {
    const r = tpm([{ dia: "20270201", valor: "7.31" }]);
    expect(r).toMatchObject({ ok: true, valores: [], conteos: { observaciones: 1, fueraDelRango: 1 } });
  });
});

describe("observaciones · ida y vuelta con el CSV canónico", () => {
  it("lo aceptado se escribe y el importador lo vuelve a leer igual (TPM e IBR)", () => {
    const t = tpm([{ dia: "20270317", valor: "7.31" }, { dia: "20270318", valor: "50" }, { dia: "20270319", valor: "0.5" }]);
    const i = leerSdmxBanrep(bytesDe(MENSAJE_IBR), IBR, DESDE, HASTA);
    if (!t.ok || !i.ok) throw new Error("las lecturas ficticias debían pasar");
    const csv = escribirCsvSeries([{ codigo: "TPM", valores: t.valores }, { codigo: "IBR_3M_EA", valores: i.valores }], HOY);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    const leido = leerCsvSeries(new TextEncoder().encode(csv.texto), HOY);
    expect(leido.ok && leido.series.map((s) => [s.codigo, s.fuente, s.valores])).toEqual([
      ["TPM", "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", t.valores],
      ["IBR_3M_EA", "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", i.valores],
    ]);
  });
});
