// Lector del SDMX de BanRep (C2c): olfateo de la página de bloqueo, errores del lector XML, raíz, cabecera, elección de la
// serie por SUBJECT + UNIT_MEASURE y su forma. Todo lo estructural falla cerrado con un código (y a lo sumo un detalle
// fijo); nada de la entrada sale en el código ni en el detalle. Mensajes ficticios (banrep.ficticio.ts).
import { describe, expect, it } from "vitest";
import { serieBanrep } from "@/datos-oficiales/fuentes/banrep-series";
import { leerSdmxBanrep } from "@/datos-oficiales/fuentes/banrep-sdmx";
import { NS_COMUN, NS_GENERICO, NS_MENSAJE } from "../lib/fixtures/sdmx.ficticio";
import {
  CAPTCHA_FICTICIO, MARCA, MENSAJE_IBR, MENSAJE_TPM, NS_FOOTER, NS_XHTML, SERIE_TPM, bytesDe, sdmxFicticio, seriesIbr, utf8, type MensajeFicticio,
} from "./banrep.ficticio";

const TPM = serieBanrep("TPM")!;
const IBR = serieBanrep("IBR_3M_EA")!;
const DESDE = new Date(Date.UTC(2027, 2, 1));
const HASTA = new Date(Date.UTC(2027, 2, 31));
const dia = (d: number) => new Date(Date.UTC(2027, 2, d));

const tpm = (m: Partial<MensajeFicticio> = {}) => leerSdmxBanrep(bytesDe({ ...MENSAJE_TPM, ...m }), TPM, DESDE, HASTA);
const texto = (s: string, serie = TPM) => leerSdmxBanrep(utf8(s), serie, DESDE, HASTA);
const fallo = (codigo: string, detalle: string | null = null) => ({ ok: false, codigo, detalle });

describe("leerSdmxBanrep · lo que se lee bien", () => {
  it("la TPM: sus tres días, en orden, como texto canónico y con la vigencia de un día", () => {
    const r = tpm();
    expect(r).toEqual({
      ok: true,
      valores: [
        { desde: dia(17), hasta: dia(17), valor: "7.31" },
        { desde: dia(18), hasta: dia(18), valor: "7.29" },
        { desde: dia(19), hasta: dia(19), valor: "13.47" },
      ],
      conteos: { observaciones: 3, fueraDelRango: 0, noDefinitivas: 0, sinValor: 0, valorInvalido: 0 },
    });
  });

  it("la IBR: de las 8 series toma la de 3 meses efectiva (IRIBRM03 + ER), nunca la nominal ni otro plazo", () => {
    const r = leerSdmxBanrep(bytesDe(MENSAJE_IBR), IBR, DESDE, HASTA);
    expect(r.ok && r.valores.map((v) => v.valor)).toEqual(["6.913", "6.917", "12.437"]);
  });

  it("los prefijos no importan: se compara por espacio de nombres (otros prefijos y espacio por defecto)", () => {
    const original = sdmxFicticio(MENSAJE_TPM);
    const renombrado = original
      .replaceAll("message:", "m:").replaceAll("xmlns:message=", "xmlns:m=")
      .replaceAll("generic:", "").replace(`xmlns:generic="${NS_GENERICO}"`, `xmlns="${NS_GENERICO}"`);
    expect(renombrado).not.toContain("generic:");
    expect(texto(renombrado)).toEqual(tpm());
  });

  it("el resultado queda congelado", () => {
    const r = tpm();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.valores)).toBe(true);
    expect(Object.isFrozen(r.conteos)).toBe(true);
    expect(r.valores.every((v) => Object.isFrozen(v))).toBe(true);
  });
});

describe("leerSdmxBanrep · página de bloqueo (captcha o HTML en vez de SDMX): BANREP_BLOQUEADO", () => {
  it.each([
    ["el captcha ficticio", CAPTCHA_FICTICIO],
    ["<html> a secas", "<html><body>x</body></html>"],
    ["BOM, espacios y DOCTYPE en mayúsculas", "﻿ \n\t<!DOCTYPE HTML><html></html>"],
    ["declaración XML y luego DOCTYPE html", "<?xml version='1.0'?>\n<!doctype html><html></html>"],
    ["un script suelto", '<script>var fict = "x";</script>'],
    ["head o body sueltos", "<head></head>"],
  ])("%s", (_caso, cuerpo) => {
    expect(texto(cuerpo)).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
  });

  // code-reviewer MEDIO: páginas de bloqueo que no empiezan por <html> o <!doctype html> (comentarios, meta, title, div).
  it.each([
    ["un comentario y luego DOCTYPE html", "<!-- aviso ficticio --><!DOCTYPE html><html><body>x</body></html>"],
    ["declaración, comentarios y espacios antes", "<?xml version='1.0'?>\n<!-- uno -->\n<!-- dos --> <html></html>"],
    ["meta y title sueltos", "<meta charset=utf-8><title>Un momento ficticio</title>"],
    ["un title suelto", "<title>Acceso ficticio</title>"],
    ["un div bien formado", "<div>bloqueado ficticio</div>"],
    ["un noscript", "<noscript>Active JavaScript</noscript>"],
  ])("%s", (_caso, cuerpo) => {
    expect(texto(cuerpo)).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
  });

  it("texto que el lector XML rechaza pero trae <html o <!doctype html al principio: también", () => {
    expect(texto("Acceso denegado ficticio <html><body>x</body></html>")).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
    expect(texto("\n\n<p>x</p><!DOCTYPE HTML>")).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
  });

  it("un comentario sin cerrar que trae <html es bloqueo; un texto suelto sin HTML lo rechaza el lector XML", () => {
    expect(texto("<!-- sin cerrar <html")).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
    expect(texto("Acceso denegado ficticio")).toEqual(fallo("BANREP_XML", "XML_MAL_FORMADO"));
  });

  it("un XHTML bien formado (raíz html en su espacio de nombres) también", () => {
    expect(texto(`<html xmlns="${NS_XHTML}"><body><p>Desafío ficticio</p></body></html>`)).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
    expect(texto(`<x:body xmlns:x="${NS_XHTML}"/>`)).toEqual(fallo("BANREP_BLOQUEADO", "HTML"));
  });

  it("una palabra parecida no es HTML: <htmlx> va al lector y sale como otra cosa", () => {
    expect(texto("<htmlx/>")).toEqual(fallo("BANREP_NO_SDMX"));
  });
});

describe("leerSdmxBanrep · el lector XML lo rechaza: BANREP_XML con el código del lector como detalle", () => {
  const conPrologo = (prologo: string) => sdmxFicticio(MENSAJE_TPM).replace("<?xml version='1.0' encoding='UTF-8'?>", `<?xml version='1.0' encoding='UTF-8'?>${prologo}`);
  it.each([
    ["DTD", conPrologo("<!DOCTYPE message:GenericData>"), "XML_DOCTYPE_PROHIBIDO"],
    ["ENTITY", conPrologo('<!ENTITY fict "x">'), "XML_ENTIDAD_PROHIBIDA"],
    ["CDATA", sdmxFicticio(MENSAJE_TPM).replace("<message:ID>", "<message:ID><![CDATA[x]]>"), "XML_CDATA_PROHIBIDO"],
    ["instrucción de procesamiento", conPrologo("<?fict x?>"), "XML_INSTRUCCION_PROHIBIDA"],
    ["mal formado", sdmxFicticio(MENSAJE_TPM).replace("</message:DataSet>", ""), "XML_ETIQUETA_DESCUADRADA"],
    ["vacío", "", "XML_SIN_RAIZ"],
  ])("%s", (_caso, cuerpo, codigo) => {
    expect(texto(cuerpo)).toEqual(fallo("BANREP_XML", codigo));
  });

  it("UTF-16 (por la BOM) y truncado a la mitad", () => {
    expect(leerSdmxBanrep(Uint8Array.from([0xff, 0xfe, 0x3c, 0x00]), TPM, DESDE, HASTA)).toEqual(fallo("BANREP_XML", "XML_CODIFICACION_NO_SOPORTADA"));
    const entero = sdmxFicticio(MENSAJE_TPM);
    expect(texto(entero.slice(0, Math.floor(entero.length / 2))).ok).toBe(false);
  });

  it("32 niveles de anidamiento se leen (y la serie falla por otra cosa); 33 los rechaza el lector", () => {
    // La raíz, DataSet, Series y Obs son 4 niveles: el relleno dentro de la Obs suma el resto.
    const anidar = (n: number) => sdmxFicticio({ ...MENSAJE_TPM, series: [{ ...SERIE_TPM, obs: [{ dia: "20270317", valor: "7.31", extra: "<n>".repeat(n) + "</n>".repeat(n) }] }] });
    expect(texto(anidar(28))).toEqual(fallo("BANREP_OBS_INVALIDA"));
    expect(texto(anidar(29))).toEqual(fallo("BANREP_XML", "XML_PROFUNDIDAD_EXCESIVA"));
  });

  it("ni el código ni el detalle llevan nada de la entrada", () => {
    const r = texto(`<?xml version='1.0'?><!DOCTYPE ${MARCA}><${MARCA}/>`);
    expect(JSON.stringify(r)).not.toContain(MARCA);
  });
});

describe("leerSdmxBanrep · raíz y cabecera", () => {
  it("un mensaje de error SDMX: BANREP_ERROR_SDMX con su code numérico (y sin detalle si no es numérico)", () => {
    const error = (code: string) => `<message:Error xmlns:message="${NS_MENSAJE}" xmlns:common="${NS_COMUN}"><message:ErrorMessage code="${code}"><common:Text>${MARCA}</common:Text></message:ErrorMessage></message:Error>`;
    expect(texto(error("100"))).toEqual(fallo("BANREP_ERROR_SDMX", "100"));
    expect(texto(error(MARCA))).toEqual(fallo("BANREP_ERROR_SDMX"));
    expect(texto(error("12345"))).toEqual(fallo("BANREP_ERROR_SDMX"));
  });

  it("otra raíz u otro espacio de nombres: BANREP_NO_SDMX", () => {
    expect(texto(`<message:StructureSpecificData xmlns:message="${NS_MENSAJE}"/>`)).toEqual(fallo("BANREP_NO_SDMX"));
    expect(texto('<message:GenericData xmlns:message="urn:fict:otro"/>')).toEqual(fallo("BANREP_NO_SDMX"));
    expect(texto("<GenericData/>")).toEqual(fallo("BANREP_NO_SDMX"));
  });

  it("la cabecera de otro dataflow (el --archivo de la otra serie): BANREP_OTRO_DATAFLOW", () => {
    expect(tpm({ dataflow: "DF_IBR_DAILY_HIST" })).toEqual(fallo("BANREP_OTRO_DATAFLOW"));
    expect(leerSdmxBanrep(bytesDe(MENSAJE_TPM), IBR, DESDE, HASTA)).toEqual(fallo("BANREP_OTRO_DATAFLOW"));
  });

  it.each([
    ["sin cabecera", { sinCabecera: true }],
    ["mensaje de prueba (Test = true)", { test: "true" }],
    ["otro emisor", { sender: "FICT" }],
    ["la dimensión de la observación no es el tiempo", { dimension: "AllDimensions" }],
    ["dos DataSet", { despues: '<message:DataSet structureRef="FICT"></message:DataSet>' }],
    ["un hijo raro en la raíz", { despues: "<message:Fict/>" }],
    ["un hijo raro en el DataSet", { enDataSet: "<generic:Group/>" }],
  ] as const)("%s: BANREP_NO_SDMX", (_caso, cambio) => {
    expect(tpm(cambio)).toEqual(fallo("BANREP_NO_SDMX"));
  });

  it("un pie (Footer, del mensaje o del espacio footer) avisa una respuesta parcial: BANREP_TRUNCADO", () => {
    expect(tpm({ despues: "<message:Footer><footer:Message code=\"413\"/></message:Footer>" })).toEqual(fallo("BANREP_TRUNCADO"));
    expect(tpm({ despues: `<f:Footer xmlns:f="${NS_FOOTER}"/>` })).toEqual(fallo("BANREP_TRUNCADO"));
  });

  it("un ID con espacios alrededor (XML reformateado) se lee igual", () => {
    const s = sdmxFicticio(MENSAJE_TPM).replace("<message:ID>DF_CBR_DAILY_HIST</message:ID>", "<message:ID>\n  DF_CBR_DAILY_HIST\n</message:ID>");
    expect(texto(s)).toEqual(tpm());
  });
});

describe("leerSdmxBanrep · elección de la serie y su forma", () => {
  it("sin la serie pedida: BANREP_SERIE_AUSENTE (otro SUBJECT o solo la nominal)", () => {
    expect(tpm({ series: [{ ...SERIE_TPM, sujeto: "IRCBRM02" }] })).toEqual(fallo("BANREP_SERIE_AUSENTE"));
    expect(tpm({ series: [] })).toEqual(fallo("BANREP_SERIE_AUSENTE"));
    const soloNominal = seriesIbr().filter((s) => !(s.sujeto === "IRIBRM03" && s.unidad === "ER"));
    expect(leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: soloNominal }), IBR, DESDE, HASTA)).toEqual(fallo("BANREP_SERIE_AUSENTE"));
  });

  it("dos series con la misma clave: BANREP_SERIE_REPETIDA", () => {
    expect(tpm({ series: [SERIE_TPM, SERIE_TPM] })).toEqual(fallo("BANREP_SERIE_REPETIDA"));
  });

  it.each([
    ["frecuencia mensual", { freq: "M" }],
    ["otra área", { area: "XX" }],
    ["UNIT_MULT distinto de 0 (los valores vendrían escalados)", { unitMult: "3" }],
    ["sin UNIT_MULT", { unitMult: null }],
  ] as const)("%s: BANREP_SERIE_DISTINTA", (_caso, cambio) => {
    expect(tpm({ series: [{ ...SERIE_TPM, ...cambio }] })).toEqual(fallo("BANREP_SERIE_DISTINTA"));
  });

  it("una SeriesKey sin SUBJECT o sin UNIT_MEASURE, o con un id repetido: BANREP_NO_SDMX", () => {
    expect(tpm({ series: [{ ...SERIE_TPM, sujeto: null }] })).toEqual(fallo("BANREP_NO_SDMX"));
    expect(tpm({ series: [{ ...SERIE_TPM, unidad: null }] })).toEqual(fallo("BANREP_NO_SDMX"));
    expect(tpm({ series: [{ ...SERIE_TPM, claveExtra: '<generic:Value id="FREQ" value="D" />' }] })).toEqual(fallo("BANREP_NO_SDMX"));
  });

  it("un hijo raro en la serie: BANREP_NO_SDMX", () => {
    expect(tpm({ series: [{ ...SERIE_TPM, extra: "<generic:Fict/>" }] })).toEqual(fallo("BANREP_NO_SDMX"));
  });

  // code-reviewer BAJO: una serie AJENA con un hijo de más (p. ej. anotaciones) no tumba la pedida; su clave sí se exige.
  it("una serie ajena con un hijo de más no estorba; una ajena sin clave legible sí (no se sabe cuál es)", () => {
    const ajenaRara = seriesIbr().map((s) => (s.sujeto === "IRIBRM06" && s.unidad === "ER" ? { ...s, extra: "<generic:Annotations/>" } : s));
    expect(leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: ajenaRara }), IBR, DESDE, HASTA).ok).toBe(true);
    const ajenaSinClave = seriesIbr().map((s) => (s.sujeto === "IRIBRM06" && s.unidad === "ER" ? { ...s, sujeto: null } : s));
    expect(leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: ajenaSinClave }), IBR, DESDE, HASTA)).toEqual(fallo("BANREP_NO_SDMX"));
  });

  it("la nominal del mismo plazo con un hijo de más tampoco estorba (se usa solo para la guarda)", () => {
    const nominalRara = seriesIbr().map((s) => (s.sujeto === "IRIBRM03" && s.unidad === "NR" ? { ...s, extra: "<generic:Annotations/>" } : s));
    expect(leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: nominalRara }), IBR, DESDE, HASTA).ok).toBe(true);
  });
});

describe("leerSdmxBanrep · guarda de la unidad de la IBR (efectiva anual ≥ nominal, cuando vienen las dos)", () => {
  const ibr = (er: Parameters<typeof seriesIbr>[0], nr: Parameters<typeof seriesIbr>[1]) => leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: seriesIbr(er, nr) }), IBR, DESDE, HASTA);

  it("un día con la efectiva por debajo de la nominal (unidades cruzadas): BANREP_UNIDAD_DUDOSA", () => {
    expect(ibr([{ dia: "20270317", valor: "6.758" }], [{ dia: "20270317", valor: "6.913" }])).toEqual(fallo("BANREP_UNIDAD_DUDOSA"));
  });

  it("iguales pasan; días sin pareja, valores o estados que no sirven no se comparan", () => {
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "6.9130" }]).ok).toBe(true);
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270318", valor: "9.999" }]).ok).toBe(true);
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "NaN" }]).ok).toBe(true);
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "9.999", estado: "P" }]).ok).toBe(true);
  });

  // code-reviewer BAJO: un día repetido con valores distintos en la NOMINAL no se compara (ni falso aviso ni aviso tapado).
  it("un día de la nominal repetido con valores distintos no se compara", () => {
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "1.237" }, { dia: "20270317", valor: "9.999" }]).ok).toBe(true);
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "9.999" }, { dia: "20270317", valor: "1.237" }]).ok).toBe(true);
    expect(ibr([{ dia: "20270317", valor: "6.913" }], [{ dia: "20270317", valor: "9.999" }, { dia: "20270317", valor: "9.9990" }])).toEqual(fallo("BANREP_UNIDAD_DUDOSA"));
  });

  it("sin la nominal en el mensaje, no hay guarda", () => {
    const sinNominal = seriesIbr().filter((s) => !(s.sujeto === "IRIBRM03" && s.unidad === "NR"));
    expect(leerSdmxBanrep(bytesDe({ ...MENSAJE_IBR, series: sinNominal }), IBR, DESDE, HASTA).ok).toBe(true);
  });
});
