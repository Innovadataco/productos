/**
 * Estructura del PDF (xref, trailer, árbol de páginas, streams, fuentes, /Info). Las mutaciones se hacen
 * sobre el PDF ficticio cambiando bytes del mismo largo, para no mover los offsets de la xref.
 */
import { describe, expect, it } from "vitest";
import { abrirDocumento, leerFechaPdf, MAX_BYTES, MAX_INFLADO_POR_STREAM } from "@/importacion/av/pdf/documento";
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
