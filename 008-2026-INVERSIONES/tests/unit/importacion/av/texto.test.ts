/**
 * Del contenido de cada página a celdas (página, x, y, texto) y de celdas a líneas. Lo que inyecta
 * `contenidoExtra` va al final de la página 1 del PDF ficticio.
 */
import { describe, expect, it } from "vitest";
import { abrirDocumento } from "@/importacion/av/pdf/documento";
import { ErrorPdf } from "@/importacion/av/pdf/errores";
import { agruparLineas, extraerLineas, type Linea } from "@/importacion/av/pdf/lector";
import { extraerCeldas, type CeldaPdf } from "@/importacion/av/pdf/texto";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type OpcionesPdf } from "../../../fixtures/av/certificacion.ficticio";

const celdas = (o: OpcionesPdf = {}): CeldaPdf[] => extraerCeldas(abrirDocumento(generarCertificacionPdf(CERTIFICACION_FICTICIA, o)));
const extra = (contenidoExtra: string): CeldaPdf[] => celdas({ contenidoExtra }).filter((c) => c.pagina === 1 && c.y < 15);
const textos = (l: Linea) => l.celdas.map((c) => c.texto);

function codigo(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorPdf) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
}

describe("extraerCeldas: el PDF ficticio", () => {
  it("cada Tj de un BT…Td…ET es una celda con su página, x, y y texto WinAnsi", () => {
    const titulo = celdas().find((c) => c.texto === "FONDOS DE INVERSIÓN");
    expect(titulo).toEqual({ pagina: 1, x: 255.2, y: 740, texto: "FONDOS DE INVERSIÓN" });
  });

  it("el pie multilínea (T*) baja una línea por cada renglón según TL", () => {
    const pie = celdas().filter((c) => c.pagina === 1 && c.x === 20 && c.y > 75 && c.y <= 90);
    expect(new Set(pie.map((c) => c.y))).toEqual(new Set([90, 83.1, 76.2]));
    expect(pie.find((c) => c.y === 83.1)?.texto).toBe("Dirección: Calle Ficticia 0 \\ oficina 0 (sede de prueba)");
  });

  it("decodifica la raya de WinAnsi (0x96) dentro del texto", () => {
    expect(celdas().some((c) => c.texto.startsWith("Edificio Acciones & Valores S.A. – Teléfono"))).toBe(true);
  });

  it("lee igual el contenido comprimido", () => {
    expect(celdas({ comprimir: true })).toEqual(celdas());
  });
});

describe("extraerCeldas: operadores de texto", () => {
  it("dos Tj seguidos sin reposicionar son una sola celda", () => {
    expect(extra("BT /F1 9 Tf 50 10 Td (COP ) Tj (1.000,00) Tj ET").map((c) => c.texto)).toEqual(["COP 1.000,00"]);
  });

  it("TJ une sus cadenas y un ajuste grande negativo es un espacio", () => {
    expect(extra("BT /F1 9 Tf 50 10 Td [(CO) 20 (P) -400 (5)] TJ ET").map((c) => c.texto)).toEqual(["COP 5"]);
  });

  it("' y \" pasan a la línea siguiente y muestran el texto", () => {
    const r = extra("BT /F1 9 Tf 4 TL 50 12 Td (a) Tj (b) ' 0 0 (c) \" ET");
    expect(r.map((c) => [c.texto, c.y])).toEqual([["a", 12], ["b", 8], ["c", 4]]);
  });

  it("Tm fija la posición y cm la traslada (q … Q la restaura)", () => {
    const r = extra("q 1 0 0 1 10 0 cm BT /F1 9 Tf 1 0 0 1 40 10 Tm (x) Tj ET Q BT /F1 9 Tf 40 11 Td (y) Tj ET");
    expect(r.map((c) => [c.texto, c.x, c.y])).toEqual([["x", 50, 10], ["y", 40, 11]]);
  });

  it("Q restaura el modo de texto y la fuente guardados por q", () => {
    expect(extra("q 3 Tr Q BT /F1 9 Tf 50 10 Td (visible) Tj ET").map((c) => c.texto)).toEqual(["visible"]);
    expect(codigo(() => celdas({ contenidoExtra: "BT /F1 9 Tf q /F7 9 Tf Q 50 10 Td (x) Tj ET" }))).toBe("PDF_CONTENIDO_INVALIDO");
  });

  it("TD fija el interlineado para T*", () => {
    const r = extra("BT /F1 9 Tf 50 14 Td 0 -5 TD (a) Tj T* (b) Tj ET");
    expect(r.map((c) => c.y)).toEqual([9, 4]);
  });
});

describe("extraerCeldas: falla cerrado", () => {
  const casos: readonly [string, string, string][] = [
    ["texto invisible (Tr 3)", "BT /F1 9 Tf 3 Tr 50 10 Td (oculto) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["texto rotado", "BT /F1 9 Tf 0 1 -1 0 50 10 Tm (girado) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["texto inclinado", "BT /F1 9 Tf 1 0.5 0 1 50 10 Tm (inclinado) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["texto espejado", "BT /F1 9 Tf -1 0 0 1 50 10 Tm (espejo) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["texto fuera de la página", "BT /F1 9 Tf 700 10 Td (afuera) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["texto de tamaño 0", "BT /F1 0 Tf 50 10 Td (enano) Tj ET", "PDF_TEXTO_NO_SOPORTADO"],
    ["una fuente que no está en la página", "BT /F99 9 Tf 50 10 Td (x) Tj ET", "PDF_FUENTE_NO_SOPORTADA"],
    ["texto con Symbol", "BT /F7 9 Tf 50 10 Td (x) Tj ET", "PDF_FUENTE_NO_SOPORTADA"],
    ["Tj fuera de BT", "(x) Tj", "PDF_CONTENIDO_INVALIDO"],
    ["Td con operandos que no son números", "BT /F1 9 Tf (a) (b) Td ET", "PDF_CONTENIDO_INVALIDO"],
    ["BT anidado", "BT BT ET ET", "PDF_CONTENIDO_INVALIDO"],
    ["Q sin q", "Q", "PDF_CONTENIDO_INVALIDO"],
    ["un operador desconocido", "1 2 XYZ", "PDF_OPERADOR_NO_SOPORTADO"],
    ["una imagen en línea (BI)", "BI /W 1 /H 1 ID x EI", "PDF_OPERADOR_NO_SOPORTADO"],
    ["una celda más larga que el tope", `BT /F1 9 Tf 50 10 Td (${"x".repeat(1100)}) Tj ET`, "PDF_DEMASIADO_TEXTO"],
    ["operandos sin operador al final", "BT /F1 9 Tf ET 1 2 3", "PDF_CONTENIDO_INVALIDO"],
    ["un BT sin cerrar al final de la página", "BT /F1 9 Tf", "PDF_CONTENIDO_INVALIDO"],
    ["un q sin su Q al final de la página", "q", "PDF_CONTENIDO_INVALIDO"],
    ["ET sin BT", "ET", "PDF_CONTENIDO_INVALIDO"],
  ];
  for (const [nombre, contenido, esperado] of casos) {
    it(nombre, () => {
      expect(codigo(() => celdas({ contenidoExtra: contenido }))).toBe(esperado);
    });
  }
});

describe("extraerLineas", () => {
  const pdf = generarCertificacionPdf();

  it("arma las líneas de arriba abajo, con sus celdas de izquierda a derecha", () => {
    const { lineas } = extraerLineas(pdf);
    const p1 = lineas.filter((l) => l.pagina === 1).map(textos);
    expect(p1[0]).toEqual(["FONDOS DE INVERSIÓN"]);
    expect(p1[1]).toEqual(["DESCRIPCIÓN", "NIT DEL FONDO", "ENCARGO", "SALDO"]);
    expect(p1).toContainEqual(["FICT1", "100", "COP 1.000,00", "COP 100.000,00"]);
    expect(p1).toContainEqual(["NEMOTÉCNICO", "CANTIDAD", "PRECIO VALORACIÓN", "VALOR DE MERCADO"]);
  });

  it("quita lo pintado dos veces en el mismo lugar (el pie)", () => {
    const { lineas } = extraerLineas(pdf);
    const defensor = lineas.filter((l) => l.pagina === 1 && textos(l).some((t) => t.startsWith("Defensor del Consumidor")));
    expect(defensor).toHaveLength(1);
    expect(defensor[0]!.celdas).toHaveLength(1);
  });

  it("devuelve la fecha de generación y el número de páginas", () => {
    const r = extraerLineas(pdf);
    expect([r.paginas, r.creadoEn?.toISOString()]).toEqual([2, "2024-01-05T15:15:00.000Z"]);
  });

  it("une en una línea las celdas con y casi igual y descarta las vacías", () => {
    const lineas = agruparLineas([
      { pagina: 1, x: 100, y: 500.4, texto: "b" },
      { pagina: 1, x: 10, y: 500, texto: "a" },
      { pagina: 1, x: 50, y: 500, texto: "  " },
      { pagina: 1, x: 10, y: 480, texto: "c" },
      { pagina: 2, x: 10, y: 800, texto: "d" },
    ]);
    expect(lineas.map((l) => [l.pagina, textos(l)])).toEqual([[1, ["a", "b"]], [1, ["c"]], [2, ["d"]]]);
  });

  it("sin ningún texto, falla con PDF_SIN_TEXTO", () => {
    expect(codigo(() => agruparLineas([{ pagina: 1, x: 1, y: 1, texto: " " }]))).toBe("PDF_SIN_TEXTO");
  });
});
