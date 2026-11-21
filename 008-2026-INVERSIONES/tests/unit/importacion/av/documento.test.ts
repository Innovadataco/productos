/**
 * Estructura del PDF (xref, trailer, árbol de páginas, streams, fuentes, /Info). Las mutaciones se hacen
 * sobre el PDF ficticio cambiando bytes del mismo largo, para no mover los offsets de la xref.
 */
import { describe, expect, it } from "vitest";
import { abrirDocumento, leerFechaPdf, MAX_BYTES, MAX_INFLADO_POR_STREAM, MAX_PAGINAS } from "@/importacion/av/pdf/documento";
import { abrirReferencias, MAX_INFLADO_TOTAL, MAX_OBJETOS } from "@/importacion/av/pdf/referencias";
import { ErrorPdf } from "@/importacion/av/pdf/errores";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type OpcionesPdf } from "../../../fixtures/av/certificacion.ficticio";

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const deLatin1 = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const pdf = (o: OpcionesPdf = {}) => generarCertificacionPdf(CERTIFICACION_FICTICIA, o);

/** Reemplaza un texto por otro del MISMO largo (los offsets de la xref siguen valiendo). */
function mutar(bytes: Uint8Array, de: string, a: string, todas = false): Uint8Array {
  expect(a.length).toBe(de.length);
  const texto = latin1(bytes);
  expect(texto).toContain(de);
  return deLatin1(todas ? texto.split(de).join(a) : texto.replace(de, a));
}

function codigo(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorPdf) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("abrirDocumento: el PDF ficticio", () => {
  it("devuelve las 2 páginas en el orden de /Kids, con su contenido y su tamaño", () => {
    const doc = abrirDocumento(pdf());
    expect(doc.paginas.map((p) => p.numero)).toEqual([1, 2]);
    expect(latin1(doc.paginas[0]!.contenido)).toContain("(FONDOS DE INVERSI\xd3N) Tj");
    expect(latin1(doc.paginas[1]!.contenido)).toContain("(SALDO EN EFECTIVO) Tj");
    expect([doc.paginas[0]!.ancho, doc.paginas[0]!.alto]).toEqual([595.28, 841.89]);
  });

  it("lee la fecha de generación de /Info (CreationDate en hora de Colombia)", () => {
    expect(abrirDocumento(pdf()).creadoEn?.toISOString()).toBe("2024-01-05T15:15:00.000Z");
  });

  it("sin CreationDate, la fecha queda en null", () => {
    expect(abrirDocumento(generarCertificacionPdf({ ...CERTIFICACION_FICTICIA, creadoEn: null })).creadoEn).toBeNull();
  });

  it("infla los content streams en FlateDecode al mismo contenido", () => {
    const plano = abrirDocumento(pdf()).paginas.map((p) => latin1(p.contenido));
    const inflado = abrirDocumento(pdf({ comprimir: true })).paginas.map((p) => latin1(p.contenido));
    expect(inflado).toEqual(plano);
  });

  it("no decodifica las imágenes (JPEG en DCT ni PNG en Flate con predictor): solo mira su diccionario", () => {
    expect(abrirDocumento(pdf()).paginas).toHaveLength(2);
    expect(abrirDocumento(pdf({ imagenConPredictor: true })).paginas).toHaveLength(2);
  });

  it("acepta /Contents como arreglo de referencias", () => {
    expect(latin1(abrirDocumento(pdf({ contenidosEnArreglo: true })).paginas[0]!.contenido)).toContain("(RENTA VARIABLE) Tj");
  });

  it("expone las fuentes de la página: Helvetica con texto, Symbol sin texto", () => {
    const fuentes = abrirDocumento(pdf()).paginas[0]!.fuentes;
    expect(fuentes.get("F1")).toEqual({ base: "Helvetica", conTexto: true });
    expect(fuentes.get("F7")).toEqual({ base: "Symbol", conTexto: false });
  });
});

describe("abrirDocumento: falla cerrado con un código", () => {
  it("lo que no empieza por %PDF- no es un PDF", () => {
    expect(codigo(() => abrirDocumento(deLatin1("hola, no soy un PDF")))).toBe("PDF_INVALIDO");
  });

  it("un archivo más grande que el tope no se lee", () => {
    expect(codigo(() => abrirDocumento(new Uint8Array(MAX_BYTES + 1)))).toBe("PDF_DEMASIADO_GRANDE");
  });

  it("un trailer con /Encrypt es un PDF cifrado", () => {
    expect(codigo(() => abrirDocumento(pdf({ trailerExtra: "/Encrypt 99 0 R" })))).toBe("PDF_CIFRADO");
  });

  it("un trailer con /Prev (actualización incremental) o /XRefStm no se soporta", () => {
    expect(codigo(() => abrirDocumento(pdf({ trailerExtra: "/Prev 0" })))).toBe("PDF_FORMATO_NO_SOPORTADO");
    expect(codigo(() => abrirDocumento(pdf({ trailerExtra: "/XRefStm 0" })))).toBe("PDF_FORMATO_NO_SOPORTADO");
  });

  it("si startxref no apunta a una tabla xref clásica, no se soporta", () => {
    const texto = latin1(pdf());
    const offset = /startxref\n(\d+)\n/.exec(texto)![1]!;
    const otro = String(Number(offset) - 7).padStart(offset.length, "0");
    expect(codigo(() => abrirDocumento(mutar(pdf(), `startxref\n${offset}\n`, `startxref\n${otro}\n`)))).toBe("PDF_FORMATO_NO_SOPORTADO");
  });

  it("una entrada de la xref que no apunta a su objeto es una xref inválida", () => {
    const texto = latin1(pdf());
    const linea = /\n(\d{10}) 00000 n \n/.exec(texto.slice(texto.lastIndexOf("\nxref\n")))![1]!;
    const corrida = String(Number(linea) + 1).padStart(10, "0");
    expect(codigo(() => abrirDocumento(mutar(pdf(), `${linea} 00000 n `, `${corrida} 00000 n `)))).toBe("PDF_XREF_INVALIDA");
  });

  it("una entrada de la xref con otra generación que la referencia es una xref inválida", () => {
    const texto = latin1(pdf());
    const linea = /\n(\d{10}) 00000 n \n/.exec(texto.slice(texto.lastIndexOf("\nxref\n")))![1]!;
    expect(codigo(() => abrirDocumento(mutar(pdf(), `${linea} 00000 n `, `${linea} 00001 n `)))).toBe("PDF_XREF_INVALIDA");
  });

  it("un /Length que no coincide con el stream lo invalida", () => {
    const texto = latin1(pdf());
    const largo = /\/Length (\d+)\n>>\nstream\n\d/.exec(texto)![1]!;
    const otro = String(Number(largo) - 1);
    expect(codigo(() => abrirDocumento(mutar(pdf(), `/Length ${largo}\n`, `/Length ${otro.padStart(largo.length, "0")}\n`)))).toBe("PDF_STREAM_INVALIDO");
  });

  it("un filtro que no es FlateDecode no se soporta", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf({ comprimir: true }), "/FlateDecode", "/LZWDecode  ")))).toBe("PDF_FILTRO_NO_SOPORTADO");
  });

  it("un stream que se infla más allá del tope falla sin agotar la memoria", () => {
    const bomba = pdf({ comprimir: true, contenidoExtra: `% ${"A".repeat(MAX_INFLADO_POR_STREAM + 10)}` });
    expect(bomba.byteLength).toBeLessThan(MAX_INFLADO_POR_STREAM / 50);
    expect(codigo(() => abrirDocumento(bomba))).toBe("PDF_INFLADO_EXCESIVO");
  });

  it("Flate corrupto es un stream inválido", () => {
    const comprimido = latin1(pdf({ comprimir: true }));
    const i = comprimido.indexOf("/FlateDecode\n>>\nstream\n") + "/FlateDecode\n>>\nstream\n".length;
    const roto = comprimido.slice(0, i + 4) + "\xff\xff\xff\xff" + comprimido.slice(i + 8);
    expect(codigo(() => abrirDocumento(deLatin1(roto)))).toBe("PDF_STREAM_INVALIDO");
  });

  it("una fuente incrustada, no estándar, sin WinAnsi o con /Differences no se soporta", () => {
    const base = "<<\n/Type /Font\n/BaseFont /Helvetica\n/Subtype /Type1\n/Encoding /WinAnsiEncoding\n";
    for (const fuenteF1 of [
      `${base}/FontFile 99 0 R\n>>`,
      `${base}/ToUnicode 99 0 R\n>>`,
      "<<\n/Type /Font\n/BaseFont /Arial\n/Subtype /Type1\n/Encoding /WinAnsiEncoding\n>>",
      "<<\n/Type /Font\n/BaseFont /Helvetica\n/Subtype /TrueType\n/Encoding /WinAnsiEncoding\n>>",
      "<<\n/Type /Font\n/BaseFont /Helvetica\n/Subtype /Type1\n/Encoding /MacRomanEncoding\n>>",
      "<<\n/Type /Font\n/BaseFont /Helvetica\n/Subtype /Type1\n/Encoding << /Differences [65 /B] >>\n>>",
      "<<\n/Type /Font\n/BaseFont /Helvetica\n/Subtype /Type1\n>>",
    ]) {
      expect(codigo(() => abrirDocumento(pdf({ fuenteF1 }))), fuenteF1).toBe("PDF_FUENTE_NO_SOPORTADA");
    }
  });

  it("un content stream en Flate con /DecodeParms (predictor) no se soporta", () => {
    expect(codigo(() => abrirDocumento(pdf({ comprimir: true, decodeParmsEnContenido: true })))).toBe("PDF_FILTRO_NO_SOPORTADO");
  });

  it("más de MAX_PAGINAS páginas no se leen; justo MAX_PAGINAS, sí (las vacías heredan recursos y tamaño)", () => {
    expect(abrirDocumento(pdf({ paginasVacias: MAX_PAGINAS - 2 })).paginas).toHaveLength(MAX_PAGINAS);
    expect(codigo(() => abrirDocumento(pdf({ paginasVacias: MAX_PAGINAS - 1 })))).toBe("PDF_DEMASIADAS_PAGINAS");
  });

  it("una xref con más entradas que el tope no se lee", () => {
    const entradas = "0000000000 65535 f \n".repeat(MAX_OBJETOS + 1);
    const pdfGrande = deLatin1(`%PDF-1.3\nxref\n0 ${MAX_OBJETOS + 1}\n${entradas}trailer\n<< >>\nstartxref\n9\n%%EOF\n`);
    expect(codigo(() => abrirDocumento(pdfGrande))).toBe("PDF_DEMASIADOS_OBJETOS");
  });

  it("un /MediaBox que no empieza en 0 0 o con tamaño no positivo es inválido", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/MediaBox [0 0 595.28", "/MediaBox [0 0 -95.28", true)))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/MediaBox [0 0 595.28", "/MediaBox [9 0 595.28", true)))).toBe("PDF_ESTRUCTURA_INVALIDA");
  });

  it("un XObject que no es imagen (formulario con texto propio) no se soporta", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/Subtype /Image", "/Subtype /Form ")))).toBe("PDF_RECURSO_NO_SOPORTADO");
  });

  it("un árbol de páginas con ciclo o con una página repetida es inválido", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/Kids [3 0 R 5 0 R ]", "/Kids [1 0 R 5 0 R ]")))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/Kids [3 0 R 5 0 R ]", "/Kids [3 0 R 3 0 R ]")))).toBe("PDF_ESTRUCTURA_INVALIDA");
  });

  it("una raíz que no es /Catalog es inválida", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf(), "/Type /Catalog", "/Type /Catalox")))).toBe("PDF_ESTRUCTURA_INVALIDA");
  });

  it("un objeto truncado (sin endobj) es inválido", () => {
    expect(codigo(() => abrirDocumento(mutar(pdf(), ">>\nendobj\n9 0 obj", ">>\nendobX\n9 0 obj")))).toBe("PDF_OBJETO_INVALIDO");
  });
});

describe("leerFechaPdf", () => {
  it("lee la fecha con zona, con Z y solo con el día", () => {
    expect(leerFechaPdf("D:20240105101500-05'00'")?.toISOString()).toBe("2024-01-05T15:15:00.000Z");
    expect(leerFechaPdf("D:20240105101500Z")?.toISOString()).toBe("2024-01-05T10:15:00.000Z");
    expect(leerFechaPdf("D:20240105")?.toISOString()).toBe("2024-01-05T00:00:00.000Z");
  });

  it("una fecha imposible o sin prefijo da null", () => {
    expect(leerFechaPdf("D:20241305101500Z")).toBeNull();
    expect(leerFechaPdf("D:20240230")).toBeNull();
    expect(leerFechaPdf("20240105")).toBeNull();
  });
});

describe("abrirDocumento: revisión de PR-A (code-reviewer A1/M2/M3 y security-reviewer ALTO-1)", () => {
  const OCHO_MB = `% ${"A".repeat(MAX_INFLADO_POR_STREAM - 100)}`;

  it("la misma referencia repetida en /Contents se rechaza de inmediato, sin inflar una vez por referencia", () => {
    const inicio = Date.now();
    expect(codigo(() => abrirDocumento(pdf({ comprimir: true, contenidoExtra: OCHO_MB, repetirFlujo: 70 })))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(Date.now() - inicio).toBeLessThan(3000);
  });

  it("más de 64 partes en /Contents se rechazan", () => {
    expect(codigo(() => abrirDocumento(pdf({ flujosExtra: { cuantos: 64, contenido: "" } })))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(abrirDocumento(pdf({ flujosExtra: { cuantos: 63, contenido: "" } })).paginas).toHaveLength(2);
  });

  it("varios streams distintos que juntos pasan el tope total fallan con INFLADO_EXCESIVO", () => {
    const seis = `% ${"B".repeat(6 * 1024 * 1024)}`;
    expect(codigo(() => abrirDocumento(pdf({ comprimir: true, flujosExtra: { cuantos: 3, contenido: seis } })))).toBe("PDF_INFLADO_EXCESIVO");
  });

  it("una referencia repetida en /Contents se rechaza aunque sean pocas", () => {
    expect(codigo(() => abrirDocumento(pdf({ repetirFlujo: 2 })))).toBe("PDF_ESTRUCTURA_INVALIDA");
  });

  it("el presupuesto de inflado es de todo el archivo: el stream que lo pasa falla, sin esperar al final", () => {
    const seis = `% ${"B".repeat(6 * 1024 * 1024)}`;
    const refs = abrirReferencias(pdf({ comprimir: true, flujosExtra: { cuantos: 3, contenido: seis } }));
    const ref = (num: number) => ({ tipo: "ref" as const, num, gen: 0 });
    expect(refs.stream(ref(200)).datos.length + refs.stream(ref(201)).datos.length).toBeLessThan(MAX_INFLADO_TOTAL);
    expect(codigo(() => refs.stream(ref(202)))).toBe("PDF_INFLADO_EXCESIVO");
  });

  it("un mismo stream sin comprimir reusado por muchas páginas no se copia sin tope", () => {
    const uno = `% ${"C".repeat(1024 * 1024)}`;
    expect(codigo(() => abrirDocumento(pdf({ contenidoExtra: uno, paginasVacias: 20, vaciasReusanContenido: true })))).toBe("PDF_INFLADO_EXCESIVO");
  });

  it("/Contents como referencia indirecta a un arreglo se lee", () => {
    expect(latin1(abrirDocumento(pdf({ contenidosIndirectos: true })).paginas[0]!.contenido)).toContain("(RENTA VARIABLE) Tj");
  });

  it("/Rotate distinto de 0 (heredado del nodo /Pages) se rechaza; /Rotate 0 se acepta", () => {
    expect(codigo(() => abrirDocumento(pdf({ rotar: 90 })))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(abrirDocumento(pdf({ rotar: 0 })).paginas).toHaveLength(2);
  });

  it("un /CropBox distinto del /MediaBox se rechaza; igual, se acepta", () => {
    expect(codigo(() => abrirDocumento(pdf({ cropBox: "[0 0 300 300]" })))).toBe("PDF_ESTRUCTURA_INVALIDA");
    expect(abrirDocumento(pdf({ cropBox: "[0 0 595.28 841.89]" })).paginas).toHaveLength(2);
  });
});
