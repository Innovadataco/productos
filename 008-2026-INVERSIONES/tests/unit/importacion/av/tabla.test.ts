/**
 * De líneas a filas de la certificación: secciones, encabezados, pie y continuación en otra página.
 * Una línea que no se entiende dentro de una sección rechaza el archivo entero (nunca se salta).
 */
import { describe, expect, it } from "vitest";
import { extraerLineas, type LecturaPdf, type Linea } from "@/importacion/av/pdf/lector";
import { ErrorTabla, leerTablaCertificacion, type FilaTabla } from "@/importacion/av/tabla";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type EspecCertificacion, type OpcionesPdf } from "../../../fixtures/av/certificacion.ficticio";

const leer = (o: OpcionesPdf = {}, espec: EspecCertificacion = CERTIFICACION_FICTICIA): FilaTabla[] =>
  leerTablaCertificacion(extraerLineas(generarCertificacionPdf(espec, o)));

const resumen = (filas: readonly FilaTabla[]) => filas.map((f) => [f.seccion, f.pagina, f.numero, f.celdas.length]);

/** Líneas armadas a mano (una celda por texto, x creciente) para los casos de estructura. */
function lectura(...paginas: (readonly (readonly string[])[])[]): LecturaPdf {
  const lineas: Linea[] = paginas.flatMap((lineasPagina, p) =>
    lineasPagina.map((celdas, i) => ({ pagina: p + 1, y: 800 - i * 20, celdas: celdas.map((texto, k) => ({ x: 20 + k * 100, texto })) })),
  );
  return { lineas, paginas: paginas.length, creadoEn: null };
}

const PIE = [["Defensor del Consumidor Financiero Sr. Ficticio"], ["Edificio Acciones & Valores S.A."], ["Página 1"]];
const RV = [["RENTA VARIABLE"], ["NEMOTÉCNICO", "CANTIDAD", "PRECIO VALORACIÓN", "VALOR DE MERCADO"], ["FICT1", "10", "COP 1,00", "COP 10,00"]];
const EFECTIVO = [["SALDO EN EFECTIVO"], ["NOMBRE", "CUENTA", "SALDO"], ["Titular Ficticio", "00000", "COP 1,00"]];

function error(f: () => unknown): { codigo: string; pagina: number; linea: number } {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorTabla) return { codigo: e.codigo, pagina: e.pagina, linea: e.linea };
    throw e;
  }
  throw new Error("no lanzó");
}

describe("leerTablaCertificacion: el PDF ficticio", () => {
  it("saca las filas de las tres secciones con su página y su número de fila del documento", () => {
    expect(resumen(leer())).toEqual([
      ["FONDOS", 1, 1, 4], ["RENTA_VARIABLE", 1, 2, 4], ["RENTA_VARIABLE", 1, 3, 4], ["RENTA_VARIABLE", 1, 4, 4], ["RENTA_VARIABLE", 1, 5, 4], ["EFECTIVO", 2, 6, 3],
    ]);
  });

  it("las celdas van en el orden de las columnas del encabezado", () => {
    const [fondo, primera] = leer();
    expect(fondo!.celdas).toEqual(["FONDO FICTICIO INMOBILIARIO UNO", "999000111-0", "000000001", "COP 5.000.000,00"]);
    expect(primera!.celdas).toEqual(["FICT1", "100", "COP 1.000,00", "COP 100.000,00"]);
  });

  it("la renta variable puede seguir en la página siguiente, con o sin el encabezado repetido", () => {
    for (const repetirEncabezado of [true, false]) {
      const filas = leer({ rvEnPagina2: 2, repetirEncabezado });
      expect(resumen(filas.filter((f) => f.seccion === "RENTA_VARIABLE"))).toEqual([
        ["RENTA_VARIABLE", 1, 2, 4], ["RENTA_VARIABLE", 1, 3, 4], ["RENTA_VARIABLE", 2, 4, 4], ["RENTA_VARIABLE", 2, 5, 4],
      ]);
    }
  });

  it("igual con el contenido comprimido", () => {
    expect(leer({ comprimir: true })).toEqual(leer());
  });

  it("acepta títulos y encabezados sin tildes ni mayúsculas exactas", () => {
    const filas = leerTablaCertificacion(lectura([["Renta Variable"], ["NEMOTECNICO", "Cantidad", "PRECIO  VALORACION", "VALOR DE MERCADO"], RV[2]!, ...EFECTIVO, ...PIE]));
    expect(resumen(filas)).toEqual([["RENTA_VARIABLE", 1, 1, 4], ["EFECTIVO", 1, 2, 3]]);
  });
});

describe("leerTablaCertificacion: rechaza el archivo entero", () => {
  it("si no es de Acciones & Valores", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...EFECTIVO])))).toEqual({ codigo: "NO_ES_CERTIFICACION_AV", pagina: 0, linea: 0 });
  });

  it("si un encabezado de columnas no es el esperado", () => {
    const otro = [RV[0]!, ["NEMOTÉCNICO", "CANTIDAX", "PRECIO VALORACIÓN", "VALOR DE MERCADO"], RV[2]!];
    expect(error(() => leerTablaCertificacion(lectura([...otro, ...EFECTIVO, ...PIE])))).toEqual({ codigo: "ENCABEZADO_DESCONOCIDO", pagina: 1, linea: 2 });
  });

  it("si una fila trae menos celdas que columnas (una celda vacía)", () => {
    const espec = { ...CERTIFICACION_FICTICIA, rentaVariable: [{ nemo: "FICT1", cantidad: "100", precio: "COP 1.000,00", valor: "" }] };
    expect(error(() => leer({}, espec)).codigo).toBe("FILA_INCOMPLETA");
  });

  it("si una fila trae más celdas que columnas", () => {
    const fila = ["FICT1", "10", "COP 1,00", "COP 10,00", "COP 1,00"];
    expect(error(() => leerTablaCertificacion(lectura([RV[0]!, RV[1]!, fila, ...EFECTIVO, ...PIE])))).toEqual({ codigo: "FILA_INCOMPLETA", pagina: 1, linea: 3 });
  });

  it("si hay un monto después del pie (nunca se salta una fila)", () => {
    expect(error(() => leer({ contenidoExtra: "BT /F1 9 Tf 300 10 Td (COP 5,00) Tj ET" })).codigo).toBe("FILA_FUERA_DE_SECCION");
  });

  it("si hay un monto antes de cualquier sección", () => {
    expect(error(() => leerTablaCertificacion(lectura([["Total", "COP 9,00"], ...RV, ...EFECTIVO, ...PIE])))).toEqual({ codigo: "FILA_FUERA_DE_SECCION", pagina: 1, linea: 1 });
  });

  it("si una sección ya cerrada vuelve a aparecer", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...EFECTIVO, ...RV, ...PIE]))).codigo).toBe("SECCION_REPETIDA");
  });

  it("si falta la sección de efectivo", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...PIE]))).codigo).toBe("SECCION_FALTANTE");
  });

  it("un título al final de una página puede tener su encabezado en la siguiente", () => {
    const filas = leerTablaCertificacion(lectura([...RV, EFECTIVO[0]!, ...PIE], [EFECTIVO[1]!, EFECTIVO[2]!]));
    expect(resumen(filas)).toEqual([["RENTA_VARIABLE", 1, 1, 4], ["EFECTIVO", 2, 2, 3]]);
  });

  it("si una sección termina sin su encabezado de columnas", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...PIE], [EFECTIVO[0]!])))).toEqual({ codigo: "ENCABEZADO_DESCONOCIDO", pagina: 2, linea: 1 });
  });

  it("si no aparece ni la sección de fondos ni la de acciones (code-reviewer B5)", () => {
    expect(error(() => leerTablaCertificacion(lectura([...EFECTIVO, ...PIE]))).codigo).toBe("SIN_FILAS");
  });

  it("acepta una certificación con la sección de acciones vacía y solo efectivo", () => {
    expect(resumen(leerTablaCertificacion(lectura([RV[0]!, RV[1]!, ...EFECTIVO, ...PIE])))).toEqual([["EFECTIVO", 1, 1, 3]]);
  });

  it("si una línea del pie trae más de una celda (una fila escondida bajo el pie, code-reviewer M5)", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...EFECTIVO, ...PIE, ["FICT9", "10"]]))).codigo).toBe("FILA_FUERA_DE_SECCION");
  });

  it("si una línea del pie trae un monto con otro formato ($)", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...EFECTIVO, ...PIE, ["Saldo $ 1.000"]]))).codigo).toBe("FILA_FUERA_DE_SECCION");
  });

  it("si el título de la sección actual se repite en la misma página (filas duplicadas, code-reviewer B1)", () => {
    expect(error(() => leerTablaCertificacion(lectura([...RV, ...RV, ...EFECTIVO, ...PIE]))).codigo).toBe("SECCION_REPETIDA");
  });

  it("acepta el título de la sección actual repetido en la página siguiente (continuación)", () => {
    const filas = leerTablaCertificacion(lectura([...RV, ...PIE], [...RV, ...EFECTIVO, ...PIE]));
    expect(resumen(filas)).toEqual([["RENTA_VARIABLE", 1, 1, 4], ["RENTA_VARIABLE", 2, 2, 4], ["EFECTIVO", 2, 3, 3]]);
  });

  it("el error nunca lleva el texto de la celda", () => {
    const fila = ["FICT1", "10", "COP 1,00", "COP 10,00", "COP 77,00"];
    try {
      leerTablaCertificacion(lectura([RV[0]!, RV[1]!, fila, ...EFECTIVO, ...PIE]));
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/FICT1|77/);
    }
  });
});
