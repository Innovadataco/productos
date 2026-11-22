/**
 * Generadores de XML para las pruebas del lector acotado (`src/lib/xml-acotado.ts`). Todo es inventado: la serie
 * `FICT_SERIE`, sus fechas (2027) y sus valores. Solo los espacios de nombres son los públicos del estándar SDMX-ML 2.1.
 * Nada de esto se versiona como `.xml` suelto: se arma en código.
 */
export const NS_MENSAJE = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message";
export const NS_GENERICO = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic";
export const NS_COMUN = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common";
export const NS_XML = "http://www.w3.org/XML/1998/namespace";

/** Marca que nunca debe aparecer en el mensaje de un error (el mensaje es fijo por código). */
export const MARCA = "FICTMARCA";

const enc = new TextEncoder();
export const utf8 = (texto: string): Uint8Array => enc.encode(texto);

export const OBSERVACIONES_FICTICIAS: readonly { readonly dia: string; readonly valor: string }[] = [
  { dia: "2027-03-17", valor: "4613.27" },
  { dia: "2027-03-18", valor: "4619.0300" },
  { dia: "2027-03-19", valor: "1e-3" },
];

/**
 * Mensaje SDMX genérico ficticio con la forma de uno real: declaración con comillas simples, `xmlns:xml` ligado a su
 * URI propio (lo permite la recomendación y lo hace una fuente pública) y valores que solo se leen como texto.
 */
export const SDMX_FICTICIO = [
  "<?xml version='1.0' encoding='UTF-8'?>",
  `<message:GenericData xmlns:message="${NS_MENSAJE}" xmlns:generic="${NS_GENERICO}" xmlns:common="${NS_COMUN}" xmlns:xml="${NS_XML}">`,
  "<message:Header>",
  "<message:ID>FICT_MENSAJE_4613</message:ID>",
  "<message:Test>true</message:Test>",
  '<message:Sender id="FICT"><common:Name xml:lang="es">Emisor ficticio &amp; asociados</common:Name></message:Sender>',
  "</message:Header>",
  "<message:DataSet>",
  "<generic:Series>",
  '<generic:SeriesKey><generic:Value id="SERIE" value="FICT_SERIE"/></generic:SeriesKey>',
  ...OBSERVACIONES_FICTICIAS.map(
    (o) => `<generic:Obs>\n  <generic:ObsDimension value="${o.dia}"/>\n  <generic:ObsValue value="${o.valor}"/>\n</generic:Obs>`,
  ),
  "</generic:Series>",
  "</message:DataSet>",
  "<!-- comentario ficticio después de los datos -->",
  "</message:GenericData>",
].join("\n");

/** `n` niveles de anidamiento (la raíz es el nivel 1). */
export const anidado = (n: number): string => "<n>".repeat(n) + "</n>".repeat(n);

/** Un elemento con `n` atributos. */
export const conAtributos = (n: number): string => `<a ${Array.from({ length: n }, (_v, k) => `a${k}="${k}"`).join(" ")}/>`;

/** `n` elementos en total: la raíz y `n - 1` hijos vacíos. */
export const conElementos = (n: number): string => `<r>${"<b/>".repeat(n - 1)}</r>`;

/** Un documento válido de exactamente `bytes` bytes en UTF-8 (con BOM si se pide; la BOM cuenta). */
export function rellenoHasta(bytes: number, bom = false): Uint8Array {
  const prefijo = bom ? "﻿" : "";
  const fijo = utf8(`${prefijo}<a></a>`).length;
  return utf8(`${prefijo}<a>${" ".repeat(bytes - fijo)}</a>`);
}

/** Nombre ASCII válido de `largo` caracteres. */
export const nombreDeLargo = (largo: number): string => "n".repeat(largo);
