import { describe, it, expect } from "vitest";
import { analyzeDocument, extractParagraphs } from "./documentProcessor";

/**
 * Casilla pendiente de §4.4 (spec 009, FR-006).
 *
 * Se prueban los extractores con texto con la forma real de una norma
 * colombiana, que es donde estos parsers se ganan o se pierden la vida. No se
 * prueba `extractPdfText`: necesitaría un PDF real y la suite corre sin
 * infraestructura (spec 002). Tras pasar a importación dinámica, importar este
 * módulo ya ni siquiera carga pdf2json.
 */

const RESOLUCION = `RESOLUCIÓN NÚMERO 1885 DE 2015

MINISTERIO DE TRANSPORTE

Por la cual se adopta el Manual de Señalización Vial, expedida el 17 de junio de 2015.

CONSIDERANDO:

Que el artículo 5 de la Ley 1450 de 2011 estableció que corresponde al Ministerio de Transporte la adopción del manual de señalización vial para todo el territorio nacional, con el fin de unificar los criterios técnicos aplicables.

OBJETO: La presente resolución tiene por objeto adoptar el Manual de Señalización Vial en su versión actualizada, de obligatorio cumplimiento para todas las entidades territoriales del país.

RESUELVE:

ARTÍCULO PRIMERO. Adoptar el Manual de Señalización Vial - Dispositivos uniformes para la regulación del tránsito en calles, carreteras y ciclorrutas de Colombia.`;

describe("analyzeDocument (spec 009, §4.4)", () => {
  const analisis = analyzeDocument(RESOLUCION);

  it("extrae el título desde la línea oficial de la norma", () => {
    expect(analisis.titulo).toContain("RESOLUCIÓN");
    expect(analisis.titulo).toContain("1885");
  });

  it("extrae el número de la norma", () => {
    expect(analisis.numero).toBe("1885");
  });

  it("normaliza la fecha escrita en letra a formato ISO", () => {
    expect(analisis.fecha).toBe("2015-06-17");
  });

  it("identifica la entidad emisora del catálogo de entidades colombianas", () => {
    expect(analisis.entidad.toLowerCase()).toContain("transporte");
  });

  it("recoge el objeto y la motivación en sus secciones", () => {
    expect(analisis.proposito.toLowerCase()).toContain("objeto");
    expect(analisis.motivacion.toLowerCase()).toContain("considerando");
  });

  it("recoge la parte resolutiva", () => {
    expect(analisis.resuelve.toUpperCase()).toContain("RESUELVE");
  });

  it("nunca devuelve campos indefinidos, aunque el texto no dé para todo", () => {
    const pobre = analyzeDocument("Texto suelto sin forma de norma.");

    for (const valor of Object.values(pobre)) expect(typeof valor).toBe("string");
    expect(pobre.titulo).toBeTruthy();
  });

  it("con texto vacío no lanza", () => {
    expect(() => analyzeDocument("")).not.toThrow();
  });
});

describe("analyzeDocument — fechas en otros formatos", () => {
  it("acepta dd/mm/aaaa y lo normaliza", () => {
    expect(analyzeDocument("Circular expedida el 05/03/2024 por la entidad.").fecha).toBe(
      "2024-03-05",
    );
  });

  it("acepta aaaa-mm-dd tal cual", () => {
    expect(analyzeDocument("Documento con fecha 2023-11-30 de referencia.").fecha).toBe(
      "2023-11-30",
    );
  });

  it("ignora los códigos de pie de página que preceden a una fecha", () => {
    // El extractor limpia "14305 31/12/2024" para no confundir un consecutivo
    // de pie de página con la fecha de expedición.
    expect(analyzeDocument("14305 31/12/2024").fecha).toBe("");
  });
});

describe("extractParagraphs (spec 009, §4.4)", () => {
  const texto = [
    "corto",
    "Este es un párrafo suficientemente largo como para superar el umbral de sesenta caracteres que aplica el extractor.",
    "Otro párrafo igualmente largo que también supera con holgura el umbral mínimo exigido por la función.",
    "Un tercero, también por encima del umbral de sesenta caracteres para que cuente como párrafo.",
  ].join("\n\n");

  it("descarta las líneas demasiado cortas para ser un párrafo", () => {
    expect(extractParagraphs(texto)).not.toContain("corto");
  });

  it("respeta el límite de párrafos que se le pide", () => {
    expect(extractParagraphs(texto, 2).split("\n\n")).toHaveLength(2);
  });

  it("con texto vacío devuelve cadena vacía, no lanza", () => {
    expect(extractParagraphs("")).toBe("");
  });
});
