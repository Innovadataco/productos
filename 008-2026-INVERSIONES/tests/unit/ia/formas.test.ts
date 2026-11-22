/**
 * Formas de los campos de hechos-v1: decimal canónico con signo, día ISO real, texto seguro, nombre de especie y
 * objeto plano de datos.
 */
import { describe, expect, it } from "vitest";
import { esDecimalCanonico, esDiaIso, esNombreEspecie, esObjetoPlano, esTextoSeguro } from "@/ia/formas";

describe("esDecimalCanonico", () => {
  it.each(["0", "7", "0.5", "-0.5", "-37911.47", "4613.27", "1237", "-1", "0.01", "12.3"])("acepta «%s»", (texto) => {
    expect(esDecimalCanonico(texto)).toBe(true);
  });

  it.each(["", "-0", "01", "-01", "1.0", "1.50", ".5", "1.", "+1", "1e3", "1E3", " 1", "1 ", "1,5", "1.237,5", "−1", "--1", "NaN", "Infinity", "0x1f", "١٢"])(
    "rechaza «%s»",
    (texto) => {
      expect(esDecimalCanonico(texto)).toBe(false);
    },
  );

  it("rechaza más de cuarenta caracteres", () => {
    expect(esDecimalCanonico("1".repeat(40))).toBe(true);
    expect(esDecimalCanonico("1".repeat(41))).toBe(false);
  });
});

describe("esDiaIso", () => {
  it.each(["2027-03-17", "2028-02-29", "2015-12-31", "2027-01-01"])("acepta «%s»", (texto) => {
    expect(esDiaIso(texto)).toBe(true);
  });

  it.each(["2027-02-29", "2027-13-01", "2027-00-10", "2027-04-31", "2027-1-05", "27-03-17", "2027/03/17", " 2027-03-17", "2027-03-17T00:00", "0027-03-17", ""])(
    "rechaza «%s»",
    (texto) => {
      expect(esDiaIso(texto)).toBe(false);
    },
  );
});

describe("esTextoSeguro", () => {
  it("acepta texto en NFC, sin controles ni espacios al borde, hasta el máximo", () => {
    expect(esTextoSeguro("$ 4.613", 64)).toBe(true);
    expect(esTextoSeguro("−2,5 %", 64)).toBe(true);
    expect(esTextoSeguro("a".repeat(7), 7)).toBe(true);
  });

  it.each([
    ["vacío", ""],
    ["más largo que el máximo", "a".repeat(8)],
    ["con espacio al inicio", " a"],
    ["con espacio al final", "a "],
    ["con salto de línea", "a\nb"],
    ["con tabulador", "a\tb"],
    ["con espacio de ancho cero", "a​b"],
    ["con marca de dirección", "a‮b"],
    ["con sustituto suelto", "a\uD800b"],
    ["fuera de NFC", "é"],
    ["con separador de línea", "a b"],
    ["con uso privado", "ab"],
  ])("rechaza texto %s", (_caso, texto) => {
    expect(esTextoSeguro(texto, 7)).toBe(false);
  });

  it("rechaza lo que no es texto", () => {
    for (const valor of [null, undefined, 7, true, {}, ["a"]]) expect(esTextoSeguro(valor, 7)).toBe(false);
  });
});

describe("esNombreEspecie", () => {
  it.each(["FICTICIA-ALFA", "FICTICIA ALFA", "Ficticia & Cía.", "FICTICIA/BETA", "FICTICIA-OMEGA-QX", "Ñandú Ficticio"])("acepta «%s»", (texto) => {
    expect(esNombreEspecie(texto)).toBe(true);
  });

  it.each(["", "-FICTICIA", "FICTICIA  ALFA", "FICTICIA_ALFA", "FICTICIA:ALFA", "FICTICIA\"ALFA", "FICTICIA{H01}", "F".repeat(49)])("rechaza «%s»", (texto) => {
    expect(esNombreEspecie(texto)).toBe(false);
  });
});

describe("esObjetoPlano", () => {
  it("acepta objetos literales y sin prototipo", () => {
    expect(esObjetoPlano({ a: 1 })).toBe(true);
    expect(esObjetoPlano(Object.create(null))).toBe(true);
  });

  it("rechaza arreglos, nulos, instancias, primitivos y objetos con getters", () => {
    class Clase {
      readonly a = 1;
    }
    const conGetter = Object.defineProperty({}, "a", { get: () => 1, enumerable: true });
    for (const valor of [null, [], new Clase(), new Date(0), new Map(), "a", 7, conGetter]) expect(esObjetoPlano(valor)).toBe(false);
  });
});
