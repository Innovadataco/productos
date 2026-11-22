/**
 * Generador de mensajes SDMX-ML 2.1 ficticios con la forma de los de BanRep (C2c). Todo es inventado: las cifras
 * (7.31, 6.913…) y las fechas (2027 en las pruebas de unidad, con `hoy` inyectado; 2019–2021 en las de CLI). Solo son
 * públicos los espacios de nombres del estándar y los códigos de las series del catálogo. Nada se versiona como `.xml`
 * suelto: se arma en código.
 */
import { NS_COMUN, NS_GENERICO, NS_MENSAJE, NS_XML, utf8 } from "../lib/fixtures/sdmx.ficticio";

export { MARCA, utf8 } from "../lib/fixtures/sdmx.ficticio";
export const NS_FOOTER = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message/footer";
export const NS_XHTML = "http://www.w3.org/1999/xhtml";

export interface ObsFicticia {
  /** AAAAMMDD; null = sin ObsDimension. */
  readonly dia: string | null;
  /** null = sin ObsValue. */
  readonly valor?: string | null;
  /** null = sin OBS_STATUS. Por defecto «A». */
  readonly estado?: string | null;
  /** Lo que se mete tal cual dentro de la Obs (mutaciones). */
  readonly extra?: string;
}

export interface SerieFicticia {
  readonly sujeto: string | null;
  readonly unidad: string | null;
  readonly freq?: string;
  readonly area?: string;
  /** null = sin UNIT_MULT. Por defecto «0». */
  readonly unitMult?: string | null;
  readonly obs: readonly ObsFicticia[];
  /** Valores de más en la SeriesKey (mutaciones). */
  readonly claveExtra?: string;
  /** Lo que se mete tal cual dentro de la Series (mutaciones). */
  readonly extra?: string;
}

export interface MensajeFicticio {
  readonly dataflow?: string;
  readonly series: readonly SerieFicticia[];
  readonly test?: string;
  readonly sender?: string;
  readonly dimension?: string;
  /** Hijos de más en la raíz, después del DataSet (Footer, otro DataSet…). */
  readonly despues?: string;
  /** Hijos de más dentro del DataSet. */
  readonly enDataSet?: string;
  /** Sin cabecera, para las mutaciones. */
  readonly sinCabecera?: boolean;
}

const valor = (id: string, v: string) => `<generic:Value id="${id}" value="${v}" />`;

function obs(o: ObsFicticia): string {
  const estado = o.estado === undefined ? "A" : o.estado;
  return [
    "<generic:Obs>",
    o.dia === null ? "" : `<generic:ObsDimension value="${o.dia}" />`,
    o.valor === null || o.valor === undefined ? "" : `<generic:ObsValue value="${o.valor}" />`,
    estado === null ? "" : `<generic:Attributes>${valor("OBS_STATUS", estado)}</generic:Attributes>`,
    o.extra ?? "",
    "</generic:Obs>",
  ].join("");
}

function serie(s: SerieFicticia): string {
  const unitMult = s.unitMult === undefined ? "0" : s.unitMult;
  const clave = [
    valor("REFERENCE_AREA", s.area ?? "CO"),
    s.sujeto === null ? "" : valor("SUBJECT", s.sujeto),
    valor("EXPENDITURE", "_Z"), valor("ACTIVITY", "_Z"), valor("ADJUSTMENT", "_Z"),
    s.unidad === null ? "" : valor("UNIT_MEASURE", s.unidad),
    valor("FREQ", s.freq ?? "D"),
    s.claveExtra ?? "",
  ].join("");
  const atributos = `<generic:Attributes>${valor("DOMAIN", "FINMARK")}${unitMult === null ? "" : valor("UNIT_MULT", unitMult)}</generic:Attributes>`;
  return `<generic:Series><generic:SeriesKey>${clave}</generic:SeriesKey>${atributos}${s.obs.map(obs).join("")}${s.extra ?? ""}</generic:Series>`;
}

/** Un mensaje GenericData ficticio, en una sola línea como los de BanRep. */
export function sdmxFicticio(m: MensajeFicticio): string {
  const dataflow = m.dataflow ?? "DF_CBR_DAILY_HIST";
  const cabecera = [
    "<message:Header>",
    `<message:ID>${dataflow}</message:ID>`,
    `<message:Test>${m.test ?? "false"}</message:Test>`,
    "<message:Prepared>2027-03-19T23:03:29</message:Prepared>",
    `<message:Sender id="${m.sender ?? "BANREP"}"><common:Name xml:lang="en">Emisor ficticio</common:Name></message:Sender>`,
    `<message:Structure structureID="FICT_STES" dimensionAtObservation="${m.dimension ?? "TIME_PERIOD"}"><common:Structure><Ref agencyID="FICT" id="STES" version="3.0" /></common:Structure></message:Structure>`,
    "<message:DataSetAction>Information</message:DataSetAction>",
    `<message:DataSetID>${dataflow}_FICT_4613</message:DataSetID>`,
    "</message:Header>",
  ].join("");
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    `<message:GenericData xmlns:footer="${NS_FOOTER}" xmlns:generic="${NS_GENERICO}" xmlns:common="${NS_COMUN}" xmlns:message="${NS_MENSAJE}" xmlns:xml="${NS_XML}">`,
    m.sinCabecera ? "" : cabecera,
    '<message:DataSet structureRef="FICT_STES">',
    m.series.map(serie).join(""),
    m.enDataSet ?? "",
    "</message:DataSet>",
    m.despues ?? "",
    "</message:GenericData>",
  ].join("");
}

export const bytesDe = (m: MensajeFicticio): Uint8Array => utf8(sdmxFicticio(m));

/** TPM ficticia: tres días seguidos de marzo de 2027. */
export const OBS_TPM: readonly ObsFicticia[] = [
  { dia: "20270317", valor: "7.31" },
  { dia: "20270318", valor: "7.29" },
  { dia: "20270319", valor: "13.47" },
];

export const SERIE_TPM: SerieFicticia = { sujeto: "IRCBRM01", unidad: "PA", obs: OBS_TPM };

/** IBR ficticia: 3 meses efectiva (la del catálogo) y, al lado, la nominal y otros plazos que no se deben tomar. */
export const OBS_IBR_ER: readonly ObsFicticia[] = [
  { dia: "20270317", valor: "6.913" },
  { dia: "20270318", valor: "6.9170" },
  { dia: "20270322", valor: "12.437" },
];
export const OBS_IBR_NR: readonly ObsFicticia[] = [
  { dia: "20270317", valor: "6.758" },
  { dia: "20270318", valor: "6.761" },
  { dia: "20270322", valor: "11.893" },
];

export function seriesIbr(er: readonly ObsFicticia[] = OBS_IBR_ER, nr: readonly ObsFicticia[] = OBS_IBR_NR): readonly SerieFicticia[] {
  const otro = (sujeto: string, unidad: string): SerieFicticia => ({ sujeto, unidad, obs: [{ dia: "20270317", valor: "4.613" }] });
  return [
    otro("IRIBRM00", "ER"), otro("IRIBRM00", "NR"), otro("IRIBRM01", "ER"), otro("IRIBRM01", "NR"),
    { sujeto: "IRIBRM03", unidad: "ER", obs: er }, { sujeto: "IRIBRM03", unidad: "NR", obs: nr },
    otro("IRIBRM06", "ER"), otro("IRIBRM06", "NR"),
  ];
}

export const MENSAJE_TPM: MensajeFicticio = { dataflow: "DF_CBR_DAILY_HIST", series: [SERIE_TPM] };
export const MENSAJE_IBR: MensajeFicticio = { dataflow: "DF_IBR_DAILY_HIST", series: seriesIbr() };

/** Página de bloqueo ficticia con la forma de las que sirve un antibots: DOCTYPE html y un script. */
export const CAPTCHA_FICTICIO =
  '<!doctype html><html lang="es"><head><title>Verificación ficticia</title><script>var fict_4613 = "FICTMARCA";</script></head><body><p>Resuelva el desafío ficticio.</p></body></html>';
