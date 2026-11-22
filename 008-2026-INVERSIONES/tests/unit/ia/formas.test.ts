/**
 * Formas de los campos de hechos-v1: decimal canónico con signo, día ISO real, texto seguro, nombre de especie y
 * objeto plano de datos.
 */
import { describe, expect, it } from "vitest";
import { esDe, esDecimalCanonico, esDiaIso, esNombreEspecie, esObjetoPlano, esTextoSeguro, soloCampos, sonDatosPuros } from "@/ia/formas";

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
    for (const valor of [null, [], new Clase(), new Date(0), new Map(), "a", 7, conGetter, new Proxy({ a: 1 }, {})]) expect(esObjetoPlano(valor)).toBe(false);
  });
});

describe("sonDatosPuros", () => {
  it("acepta texto, booleanos, null, undefined, números finitos, arreglos densos y objetos planos anidados", () => {
    for (const valor of ["x", true, null, undefined, 7, -4613.27, [], [1, "a", [null]], { a: { b: [{ c: false }] } }, Object.create(null)]) expect(sonDatosPuros(valor)).toBe(true);
  });

  it("rechaza Proxy, getters, símbolos, propiedades de más o huecos en arreglos, subclases y valores sin forma JSON", () => {
    class SubArreglo extends Array<number> {}
    const conGetter = Object.defineProperty({}, "a", { get: () => 1, enumerable: true });
    const indiceAccesor = Object.defineProperty(["a", "b"], 1, { get: () => "c", enumerable: true });
    const conExtra = Object.assign(["a"], { extra: "b" });
    const conToJson = Object.assign(["a"], { toJSON: () => [] });
    const conSimbolo = { a: 1, [Symbol("s")]: 2 };
    let profundo: unknown = "x";
    for (let i = 0; i < 70; i += 1) profundo = [profundo];
    const malos = [
      new Proxy({}, {}), new Proxy([], {}), conGetter, indiceAccesor, conExtra, conToJson, conSimbolo, [1, , 3], SubArreglo.from([1]),
      new Date(0), new Map(), () => 1, Symbol("s"), 7n, Number.NaN, Number.POSITIVE_INFINITY, profundo, { a: [() => 1] },
    ];
    malos.forEach((valor, i) => expect(sonDatosPuros(valor), `caso ${i}`).toBe(false));
  });
});

describe("esDe y soloCampos", () => {
  it("esDe: solo textos de la lista", () => {
    expect(esDe(["A", "B"], "A")).toBe(true);
    for (const valor of ["C", 7, null, undefined]) expect(esDe(["A", "B"], valor)).toBe(false);
  });

  it("soloCampos: ningún campo fuera de la lista", () => {
    expect(soloCampos({ a: 1 }, ["a", "b"])).toBe(true);
    expect(soloCampos({ a: 1, c: 2 }, ["a", "b"])).toBe(false);
  });
});
