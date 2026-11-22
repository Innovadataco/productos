// Lector del anexo de índices del IPC del DANE (src/datos-oficiales/fuentes/dane-ipc.ts, C2d): redondeo del float con
// tolerancia, estructura del libro, textos compartidos, celdas, etiquetas, tabla «Mes» × años, valores y periodo
// (MES_ABIERTO), con su precedencia fija. Puro, sin red ni base. Valores inventados (tests/unit/datos-oficiales/
// anexo-ipc.ficticio.ts); años anteriores a 2022 y «hoy» de 2027 o del propio año ficticio.
import { describe, expect, it } from "vitest";
import { armarZip, ascii } from "../lib/fixtures/xlsx.ficticio";
import {
  BASE, NS_MAIN, NS_R, NS_STRICT, PARTE_HOJA, PARTE_LIBRO, PARTE_RELS, PARTE_TEXTOS, TITULO, anexoIpc, celdaNumero, celdaTexto, valorCanonico,
  type OpcionesAnexo,
} from "./anexo-ipc.ficticio";
import { serieDelCatalogo, type RangoCordura } from "@/datos-oficiales/catalogo";
import { MAX_ANIOS_ANEXO, leerAnexoIpc, redondearIndice } from "@/datos-oficiales/fuentes/dane-ipc";

const d = (anio: number, mes: number, dia: number): Date => new Date(Date.UTC(anio, mes - 1, dia));
const HOY = d(2027, 3, 17);
const SERIE = serieDelCatalogo("IPC_INDICE")!;
const leer = (o: OpcionesAnexo = {}, hoy: Date = HOY) => leerAnexoIpc(anexoIpc(o), hoy);
const formato = (detalle: string, celda?: string) => ({ ok: false, codigo: "DANE_FORMATO", detalle, ...(celda ? { celda } : {}) });
const en = (codigo: string, celda: string) => ({ ok: false, codigo, celda });
/** Reemplaza la celda del mes k por `xml` (las demás quedan como siempre). */
const enMes = (kBuscado: number, xml: (r: string) => string): OpcionesAnexo["valor"] => (k, r) => (k === kBuscado ? xml(r) : undefined);

describe("redondearIndice · el float del xlsx a la escala del catálogo, en texto (nunca Number)", () => {
  it.each([
    ["413.29", "413.29"],
    ["431", "431"],
    ["433.5", "433.5"],
    ["419.10", "419.1"],
    ["417.40000000000004", "417.4"],
    ["417.3999999999999998", "417.4"],
    ["99.999999999999993", "100"],
    ["123456.12", "123456.12"],
  ])("%s → %s", (texto, esperado) => {
    expect(redondearIndice(texto, 2)).toBe(esperado);
  });

  it("la tolerancia es 1e-9, con el borde incluido, por arriba y por abajo", () => {
    expect(redondearIndice("413.290000001", 2)).toBe("413.29");
    expect(redondearIndice("413.289999999", 2)).toBe("413.29");
    expect(redondearIndice("413.29000000100000000001", 2)).toBeNull();
    expect(redondearIndice("413.28999999899999999999", 2)).toBeNull();
  });

  it.each(["413.295", "413.291", "4.1329E+2", "-413.29", "+413.29", "", " 413.29", "413.29 ", "413,29", "1234567.1", "413.", ".29", "413.290000000000000000001", "0x19d"])(
    "rechaza %j",
    (texto) => {
      expect(redondearIndice(texto, 2)).toBeNull();
    },
  );

  it("otras escalas: 0 decimales y 3", () => {
    expect(redondearIndice("413.0000000000001", 0)).toBe("413");
    expect(redondearIndice("412.9999999999999", 0)).toBe("413");
    expect(redondearIndice("413.5", 0)).toBeNull();
    expect(redondearIndice("413.2915", 3)).toBeNull();
    expect(redondearIndice("413.29100000000003", 3)).toBe("413.291");
  });
});

describe("leerAnexoIpc · el anexo por defecto", () => {
  it("31 meses desde enero de 1997, redondeados a 2 decimales, sin ceros sobrantes y congelados", () => {
    const r = leer();
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.valores.map((v) => v.valor)).toEqual(Array.from({ length: 31 }, (_v, k) => valorCanonico(k)));
    expect(r.valores[0]).toEqual({ desde: d(1997, 1, 1), hasta: d(1997, 1, 31), valor: "413.29" });
    expect(r.valores[1]).toMatchObject({ desde: d(1997, 2, 1), hasta: d(1997, 2, 28) });
    expect(r.valores[30]).toMatchObject({ desde: d(1999, 7, 1), hasta: d(1999, 7, 31) });
    expect(Object.isFrozen(r.valores)).toBe(true);
    expect(Object.isFrozen(r.valores[0])).toBe(true);
  });

  it("año bisiesto: febrero hasta el 29", () => {
    const r = leer({ primerAnio: 2000, anios: 1, publicados: 2 });
    expect(r).toMatchObject({ ok: true, valores: [{ hasta: d(2000, 1, 31) }, { desde: d(2000, 2, 1), hasta: d(2000, 2, 29) }] });
  });

  it("la tabla puede estar en otra columna y otra fila: se ubica por la etiqueta «Mes»", () => {
    expect(leer({ columnaMes: "C", filaMes: 12 })).toMatchObject({ ok: true, valores: { length: 31 } });
  });
});

describe("leerAnexoIpc · el contenedor (los lectores acotados)", () => {
  it("lo que no es un zip sale ANEXO_ZIP con el código del lector (también un .xls viejo)", () => {
    expect(leerAnexoIpc(ascii("FICT esto no es un xlsx"), HOY)).toMatchObject({ ok: false, codigo: "ANEXO_ZIP", detalle: expect.stringMatching(/^ZIP_/) });
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Uint8Array(504)]);
    expect(leerAnexoIpc(ole, HOY)).toMatchObject({ ok: false, codigo: "ANEXO_ZIP", detalle: expect.stringMatching(/^ZIP_/) });
  });

  it("una parte con el CRC malo: ANEXO_ZIP · ZIP_CRC_INVALIDO", () => {
    const zip = armarZip([{ nombre: PARTE_LIBRO, datos: ascii(`<workbook xmlns="${NS_MAIN}"/>`), crc: 0x1237 }]);
    expect(leerAnexoIpc(zip, HOY)).toEqual({ ok: false, codigo: "ANEXO_ZIP", detalle: "ZIP_CRC_INVALIDO" });
  });

  it("una parte que no es XML aceptable: ANEXO_XML con el código del lector", () => {
    const doctype = leer({ hoja: (x) => x.replace("?>", "?><!DOCTYPE worksheet>") });
    expect(doctype).toEqual({ ok: false, codigo: "ANEXO_XML", detalle: "XML_DOCTYPE_PROHIBIDO" });
    expect(leer({ partes: { [PARTE_LIBRO]: "FICT no es XML" } })).toMatchObject({ ok: false, codigo: "ANEXO_XML", detalle: expect.stringMatching(/^XML_/) });
  });
});

describe("leerAnexoIpc · libro y relaciones (DANE_FORMATO con su detalle)", () => {
  it.each([PARTE_LIBRO, PARTE_RELS, PARTE_HOJA, PARTE_TEXTOS])("sin %s: PARTES", (parte) => {
    expect(leer({ partes: { [parte]: null } })).toEqual(formato("PARTES"));
  });

  it("libro: strict, otra raíz, 0 o 2 hojas, sin <sheets>", () => {
    expect(leer({ libro: (x) => x.replace(`xmlns="${NS_MAIN}"`, `xmlns="${NS_STRICT}"`) })).toEqual(formato("STRICT"));
    expect(leer({ libro: (x) => x.replace("<workbook ", "<libro ").replace("</workbook>", "</libro>") })).toEqual(formato("RAIZ"));
    expect(leer({ libro: (x) => x.replace(/<sheet [^>]*\/>/, "") })).toEqual(formato("HOJAS"));
    expect(leer({ libro: (x) => x.replace("</sheets>", '<sheet name="FICT" sheetId="2" r:id="rId9"/></sheets>') })).toEqual(formato("HOJAS"));
    expect(leer({ libro: (x) => x.replace(/<sheets>.*<\/sheets>/, "") })).toEqual(formato("HOJAS"));
  });

  it("la relación de la hoja: sin r:id, id inexistente o repetido, otro tipo, externa o fuera de xl/worksheets/", () => {
    expect(leer({ libro: (x) => x.replace(' r:id="rId1"', "") })).toEqual(formato("REL"));
    expect(leer({ libro: (x) => x.replace('r:id="rId1"', 'r:id="rId7"') })).toEqual(formato("REL"));
    expect(leer({ rels: (x) => x.replace("</Relationships>", `<Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) })).toEqual(formato("REL"));
    expect(leer({ rels: (x) => x.replace(`${NS_R}/worksheet"`, `${NS_R}/chartsheet"`) })).toEqual(formato("REL"));
    expect(leer({ rels: (x) => x.replace('Target="worksheets/sheet1.xml"', 'Target="worksheets/sheet1.xml" TargetMode="External"') })).toEqual(formato("REL"));
    for (const destino of ["../sheet1.xml", "worksheets/../worksheets/sheet1.xml", "worksheets/sub/sheet1.xml", "/docProps/sheet1.xml", "worksheets/sheet1.bin"]) {
      expect(leer({ rels: (x) => x.replace('Target="worksheets/sheet1.xml"', `Target="${destino}"`) }), destino).toEqual(formato("REL"));
    }
  });

  it("la relación de la hoja: absoluta o con TargetMode Internal sirve", () => {
    expect(leer({ rels: (x) => x.replace('Target="worksheets/sheet1.xml"', 'Target="/xl/worksheets/sheet1.xml"') })).toMatchObject({ ok: true });
    expect(leer({ rels: (x) => x.replace('Target="worksheets/sheet1.xml"', 'Target="worksheets/sheet1.xml" TargetMode="Internal"') })).toMatchObject({ ok: true });
  });

  it("los textos compartidos: sin relación, dos, externa o fuera de xl/; la absoluta sirve", () => {
    expect(leer({ rels: (x) => x.replace(/<Relationship Id="rId4"[^>]*\/>/, "") })).toEqual(formato("SST"));
    expect(leer({ rels: (x) => x.replace("</Relationships>", `<Relationship Id="rId5" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`) })).toEqual(formato("SST"));
    expect(leer({ rels: (x) => x.replace('Target="sharedStrings.xml"', 'Target="sharedStrings.xml" TargetMode="External"') })).toEqual(formato("SST"));
    expect(leer({ rels: (x) => x.replace('Target="sharedStrings.xml"', 'Target="../sst.xml"') })).toEqual(formato("SST"));
    expect(leer({ rels: (x) => x.replace('Target="sharedStrings.xml"', 'Target="/xl/sharedStrings.xml"') })).toMatchObject({ ok: true });
  });

  it("raíces de las relaciones, de los textos y de la hoja; la hoja strict; sheetData 0 o 2 veces", () => {
    expect(leer({ rels: (x) => x.replace(/xmlns="[^"]+"/, `xmlns="${NS_MAIN}"`) })).toEqual(formato("RAIZ"));
    expect(leer({ textos: (x) => x.replace("<sst ", "<sstx ").replace("</sst>", "</sstx>") })).toEqual(formato("RAIZ"));
    expect(leer({ hoja: (x) => x.replace("<worksheet ", "<hoja ").replace("</worksheet>", "</hoja>") })).toEqual(formato("RAIZ"));
    expect(leer({ hoja: (x) => x.replace(`xmlns="${NS_MAIN}"`, `xmlns="${NS_STRICT}"`) })).toEqual(formato("STRICT"));
    expect(leer({ hoja: (x) => x.replace(/<sheetData>.*<\/sheetData>/, "") })).toEqual(formato("RAIZ"));
    expect(leer({ hoja: (x) => x.replace("</sheetData>", "</sheetData><sheetData/>") })).toEqual(formato("RAIZ"));
  });
});

describe("leerAnexoIpc · textos compartidos", () => {
  it("una etiqueta partida en runs se lee entera; la fonética (rPh) no cuenta", () => {
    expect(leer({ textos: (x) => x.replace("<si><t>Mes</t></si>", "<si><r><t>M</t></r><r><rPr><b/></rPr><t>es</t></r></si>") })).toMatchObject({ ok: true });
    const conFonetica = `<si><t>${TITULO}</t><rPh sb="0" eb="1"><t>FICT</t></rPh><phoneticPr fontId="1"/></si>`;
    expect(leer({ textos: (x) => x.replace(`<si><t>${TITULO}</t></si>`, conFonetica) })).toMatchObject({ ok: true });
  });

  it("un <t> de otro espacio de nombres dentro de <si> no cuenta (no se suma a la etiqueta)", () => {
    const ajeno = '<x:t xmlns:x="urn:ficticio">FICT</x:t>';
    expect(leer({ textos: (x) => x.replace("<si><t>Mes</t></si>", `<si><t>Mes</t>${ajeno}</si>`) })).toMatchObject({ ok: true });
    expect(leer({ textos: (x) => x.replace("<si><t>Mes</t></si>", `<si>${ajeno}</si>`) })).toEqual(formato("MES"));
  });

  it('una celda t="s" sin <v> está vacía (un mes no publicado)', () => {
    expect(leer({ valor: enMes(31, (r) => `<c r="${r}" s="14" t="s"/>`) })).toMatchObject({ ok: true, valores: { length: 31 } });
  });

  it("una relación sin Target: REL (la de la hoja) o SST (la de los textos)", () => {
    expect(leer({ rels: (x) => x.replace(' Target="worksheets/sheet1.xml"', "") })).toEqual(formato("REL"));
    expect(leer({ rels: (x) => x.replace(' Target="sharedStrings.xml"', "") })).toEqual(formato("SST"));
  });

  it("un índice fuera de la lista o mal escrito: SST con la celda (dentro o fuera de la tabla)", () => {
    expect(leer({ mes: (m, r) => (m === 3 ? `<c r="${r}" t="s"><v>20</v></c>` : undefined) })).toEqual(formato("SST", "A13"));
    expect(leer({ mes: (m, r) => (m === 3 ? `<c r="${r}" t="s"><v>01</v></c>` : undefined) })).toEqual(formato("SST", "A13"));
    expect(leer({ mes: (m, r) => (m === 3 ? `<c r="${r}" t="s"><v>-1</v></c>` : undefined) })).toEqual(formato("SST", "A13"));
    expect(leer({ extraFilaAnios: '<c r="Z9" t="s"><v>99</v></c>' })).toEqual(formato("SST", "Z9"));
  });
});

describe("leerAnexoIpc · celdas y filas (estricto solo en lo que se lee)", () => {
  it("referencias: sin r, mal escrita, de otra fila, repetida; filas sin r, mal escritas o desordenadas", () => {
    expect(leer({ valor: enMes(0, () => '<c s="10"><v>413.29</v></c>') })).toEqual(formato("REF"));
    for (const malo of ["b10", "B0", "AAAA10", "B10 ", "B12345678"]) expect(leer({ valor: enMes(0, () => `<c r="${malo}"><v>413.29</v></c>`) }), malo).toEqual(formato("REF"));
    expect(leer({ valor: enMes(0, () => '<c r="E11"><v>413.29</v></c>') })).toEqual(formato("REF"));
    expect(leer({ extraFilaAnios: celdaNumero("B9", "1997") })).toEqual(formato("REF"));
    expect(leer({ hoja: (x) => x.replace('<row r="1" ', "<row ") })).toEqual(formato("REF"));
    expect(leer({ hoja: (x) => x.replace('<row r="1" ', '<row r="01" ') })).toEqual(formato("REF"));
    expect(leer({ hoja: (x) => x.replace('<row r="1" ', '<row r="30" ') })).toEqual(formato("REF"));
  });

  it("un tipo que no es de OOXML, en cualquier celda (aun vacía): TIPO con la celda", () => {
    expect(leer({ hoja: (x) => x.replace(celdaTexto("A25", 19), `${celdaTexto("A25", 19)}<c r="B25" t="x"/>`) })).toEqual(formato("TIPO", "B25"));
  });

  it("fuera de la tabla se admiten fórmulas, texto en línea, booleanos, errores y fechas", () => {
    const notas = '<c r="B24" t="str"><f>A24</f><v>FICT</v></c><c r="C24" t="inlineStr"><is><t>FICT</t></is></c><c r="D24" t="b"><v>1</v></c><c r="E24" t="e"><v>#N/A</v></c><c r="F24" t="d"><v>2027-03-17</v></c>';
    expect(leer({ hoja: (x) => x.replace(celdaTexto("A24", 15), `${celdaTexto("A24", 15)}${notas}`) })).toMatchObject({ ok: true, valores: { length: 31 } });
  });
});

describe("leerAnexoIpc · etiquetas (normalizadas: NFC, espacios, mayúsculas)", () => {
  it("«Mes» ausente o dos veces: MES", () => {
    expect(leer({ etiquetas: { mes: null } })).toEqual(formato("MES"));
    expect(leer({ hoja: (x) => x.replace(celdaTexto("A25", 19), `${celdaTexto("A25", 19)}${celdaTexto("B25", 14)}`) })).toEqual(formato("MES"));
  });

  it("sin el título del IPC total o sin «Número Índice»: TITULO (otro anexo del DANE no pasa)", () => {
    expect(leer({ etiquetas: { titulo: null } })).toEqual(formato("TITULO"));
    expect(leer({ etiquetas: { titulo: "Alimentos y bebidas no alcohólicas (ficticio)" } })).toEqual(formato("TITULO"));
    expect(leer({ etiquetas: { numero: null } })).toEqual(formato("TITULO"));
    expect(leer({ etiquetas: { numero: "Variación mensual (ficticia)" } })).toEqual(formato("TITULO"));
  });

  it("otra base o sin base: DANE_BASE_DISTINTA", () => {
    expect(leer({ etiquetas: { base: "Base Diciembre de 2008 = 100,00" } })).toEqual({ ok: false, codigo: "DANE_BASE_DISTINTA" });
    expect(leer({ etiquetas: { base: null } })).toEqual({ ok: false, codigo: "DANE_BASE_DISTINTA" });
  });

  it("espacios de más, espacio duro, mayúsculas y tildes descompuestas (NFD) no cambian la etiqueta", () => {
    const etiquetas = { mes: "  MES ", titulo: "Total, índice de  precios al consumidor (IPC)", numero: "Número Índice", base: BASE.toUpperCase() };
    expect(leer({ etiquetas, textos: (x) => x.replace("<t>Enero</t>", "<t> ENERO </t>") })).toMatchObject({ ok: true, valores: { length: 31 } });
  });

  it("precedencia: MES, después TITULO, después la base", () => {
    expect(leer({ etiquetas: { mes: null, titulo: null, base: null } })).toEqual(formato("MES"));
    expect(leer({ etiquetas: { titulo: null, base: null } })).toEqual(formato("TITULO"));
  });
});

describe("leerAnexoIpc · la tabla «Mes» × años", () => {
  it("años no consecutivos, como texto, con fórmula o fuera de 19AA–20AA: DANE_ANIOS con la celda", () => {
    expect(leer({ anio: (i, r) => (i > 0 ? celdaNumero(r, String(1998 + i)) : undefined) })).toEqual(en("DANE_ANIOS", "C9"));
    expect(leer({ anio: (i, r) => (i === 0 ? celdaTexto(r, 16) : undefined) })).toEqual(en("DANE_ANIOS", "B9"));
    expect(leer({ anio: (i, r) => (i === 0 ? `<c r="${r}"><f>1996+1</f><v>1997</v></c>` : undefined) })).toEqual(en("DANE_ANIOS", "B9"));
    for (const malo of ["1897", "1997.5", "2100", "01997", ""]) expect(leer({ anio: (i, r) => (i === 0 ? celdaNumero(r, malo) : undefined) }), malo).toEqual(en("DANE_ANIOS", "B9"));
  });

  it("sin años a la derecha de «Mes»: DANE_ANIOS en la primera celda esperada", () => {
    expect(leer({ anio: () => "" })).toEqual(en("DANE_ANIOS", "B9"));
  });

  it(`tope de ${MAX_ANIOS_ANEXO} años: ${MAX_ANIOS_ANEXO} pasan (con el acarreo del redondeo) y ${MAX_ANIOS_ANEXO + 1} no`, () => {
    const cien = leer({ primerAnio: 1901, anios: MAX_ANIOS_ANEXO, publicados: MAX_ANIOS_ANEXO * 12 });
    if (!cien.ok) throw new Error(JSON.stringify(cien));
    expect(cien.valores.map((v) => v.valor)).toEqual(Array.from({ length: MAX_ANIOS_ANEXO * 12 }, (_v, k) => valorCanonico(k)));
    expect(cien.valores[383]!.valor).toBe("555");
    expect(leer({ primerAnio: 1901, anios: MAX_ANIOS_ANEXO + 1, publicados: 12 })).toEqual(formato("TOPE_ANIOS", "CX9"));
  });

  it("un valor a la derecha del último año (en la fila de años o en una de meses): FUERA_DE_TABLA; una celda vacía con estilo, no", () => {
    expect(leer({ extraFilaAnios: celdaTexto("F9", 16) })).toEqual(formato("FUERA_DE_TABLA", "F9"));
    expect(leer({ extraFilaMes: (m) => (m === 4 ? celdaNumero("E14", "471.93") : "") })).toEqual(formato("FUERA_DE_TABLA", "E14"));
    expect(leer({ extraFilaMes: (m) => (m === 4 ? '<c r="E14" s="10"/><c r="G14" s="7"/>' : "") })).toMatchObject({ ok: true });
  });

  it("los 12 meses en orden bajo «Mes»: otro nombre, desorden, ausente o un número es DANE_MES_DESCONOCIDO", () => {
    expect(leer({ textos: (x) => x.replace("<t>Septiembre</t>", "<t>Setiembre</t>") })).toEqual(en("DANE_MES_DESCONOCIDO", "A18"));
    expect(leer({ textos: (x) => x.replace("<t>Marzo</t>", "<t>FICT</t>").replace("<t>Abril</t>", "<t>Marzo</t>").replace("<t>FICT</t>", "<t>Abril</t>") })).toEqual(en("DANE_MES_DESCONOCIDO", "A12"));
    expect(leer({ mes: (m) => (m === 11 ? "" : undefined) })).toEqual(en("DANE_MES_DESCONOCIDO", "A21"));
    expect(leer({ mes: (m, r) => (m === 0 ? celdaNumero(r, "1") : undefined) })).toEqual(en("DANE_MES_DESCONOCIDO", "A10"));
  });
});

describe("leerAnexoIpc · los valores (en orden cronológico)", () => {
  it.each([
    ["fórmula", (r: string) => `<c r="${r}"><f>B13+1</f><v>414.77</v></c>`],
    ["texto de fórmula", (r: string) => `<c r="${r}" t="str"><v>414.77</v></c>`],
    ["texto compartido", (r: string) => celdaTexto(r, 16)],
    ["texto en línea", (r: string) => `<c r="${r}" t="inlineStr"><is><t>414.77</t></is></c>`],
    ["booleano", (r: string) => `<c r="${r}" t="b"><v>1</v></c>`],
    ["error", (r: string) => `<c r="${r}" t="e"><v>#N/A</v></c>`],
    ["<v></v>", (r: string) => `<c r="${r}"><v></v></c>`],
  ])("%s: DANE_CELDA con la celda", (_caso, xml) => {
    expect(leer({ valor: enMes(4, xml) })).toEqual(en("DANE_CELDA", "B14"));
  });

  it('t="n" explícito sirve', () => {
    expect(leer({ valor: enMes(4, (r) => `<c r="${r}" t="n"><v>414.77</v></c>`) })).toMatchObject({ ok: true });
  });

  it("un decimal de más (no un artefacto) o un exponente: DANE_VALOR", () => {
    expect(leer({ valor: enMes(4, (r) => celdaNumero(r, "414.775")) })).toEqual(en("DANE_VALOR", "B14"));
    expect(leer({ valor: enMes(4, (r) => celdaNumero(r, "4.1477E+2")) })).toEqual(en("DANE_VALOR", "B14"));
  });

  it("el rango de cordura del catálogo: 10 y 1000 pasan; 9.99 y 1000.01 no", () => {
    const bordes = leer({ valor: (k, r) => (k === 3 ? celdaNumero(r, "10") : k === 4 ? celdaNumero(r, "1000") : undefined) });
    expect(bordes).toMatchObject({ ok: true, valores: { 3: { valor: "10" }, 4: { valor: "1000" } } });
    expect(leer({ valor: enMes(4, (r) => celdaNumero(r, "9.99")) })).toEqual(en("VALOR_FUERA_DE_RANGO", "B14"));
    expect(leer({ valor: enMes(4, (r) => celdaNumero(r, "1000.01")) })).toEqual(en("VALOR_FUERA_DE_RANGO", "B14"));
  });

  it("gana el primero en el tiempo (noviembre de 1997, B20), no el primero del XML (marzo de 1998, C12)", () => {
    const dos = leer({ valor: (k, r) => (k === 14 ? celdaNumero(r, "414.775") : k === 10 ? celdaNumero(r, "1000.01") : undefined) });
    expect(dos).toEqual(en("VALOR_FUERA_DE_RANGO", "B20"));
  });
});

describe("leerAnexoIpc · la serie y el periodo", () => {
  it("un mes que falta antes del último publicado: DANE_HUECO (al inicio, en medio o con la celda vacía con estilo)", () => {
    expect(leer({ valor: enMes(0, () => "") })).toEqual(en("DANE_HUECO", "B10"));
    expect(leer({ valor: enMes(5, () => "") })).toEqual(en("DANE_HUECO", "B15"));
    expect(leer({ valor: enMes(5, (r) => `<c r="${r}" s="10"/>`) })).toEqual(en("DANE_HUECO", "B15"));
    expect(leer({ valor: enMes(12, () => "") })).toEqual(en("DANE_HUECO", "C10"));
  });

  it("sin ningún valor: SIN_VALORES", () => {
    expect(leer({ publicados: 0 })).toEqual({ ok: false, codigo: "SIN_VALORES" });
  });

  it("MES_ABIERTO: el mes que terminó ayer entra; el que termina hoy, o uno posterior, no", () => {
    expect(leer({}, d(1999, 8, 1))).toMatchObject({ ok: true, valores: { length: 31 } });
    expect(leer({}, d(1999, 7, 31))).toEqual(en("MES_ABIERTO", "D16"));
    expect(leer({}, d(1998, 6, 17))).toEqual(en("MES_ABIERTO", "C15"));
  });

  it("precedencia: celda → hueco → periodo; el rango va con la celda", () => {
    expect(leer({ valor: enMes(5, () => "") }, d(1999, 7, 31))).toEqual(en("DANE_HUECO", "B15"));
    expect(leer({ valor: (k, r) => (k === 3 ? `<c r="${r}"><f>1</f><v>1</v></c>` : k === 5 ? "" : undefined) })).toEqual(en("DANE_CELDA", "B13"));
    expect(leer({ valor: enMes(30, (r) => celdaNumero(r, "1000.01")) }, d(1999, 7, 31))).toEqual(en("VALOR_FUERA_DE_RANGO", "D16"));
  });

  it("un fallo no previsto sale ERROR_INTERNO, nunca como un cambio del DANE ni como excepción", () => {
    const rota = { ...SERIE, rango: undefined as unknown as RangoCordura };
    expect(leerAnexoIpc(anexoIpc(), HOY, rota)).toEqual({ ok: false, codigo: "ERROR_INTERNO" });
  });
});
