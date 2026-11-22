// Un valor que suma varios datos (frente fecha-hora-datos): muestra el dato MÁS VIEJO que lo compone y si hay fechas
// distintas. Puro: no toca la entrada. Con dos del mismo día, el traído antes; sin la hora en que se trajo, ese cuenta
// como el más viejo (no se sabe, así que no se presenta como fresco). Datos inventados.
import { describe, expect, it } from "vitest";
import { componer } from "@/app/_comun/fecha-dato/componer";
import type { Procedencia } from "@/app/_comun/fecha-dato/tipos";

const p = (dia: string, traidoEn: string | null, fuente: string | null = "yahoo"): Procedencia => ({ dia, traidoEn, fuente });

describe("componer", () => {
  it("sin datos no hay procedencia", () => {
    expect(componer([])).toBeNull();
  });

  it("con fechas distintas: el dato de la fecha más vieja, la más reciente y el aviso encendido", () => {
    const viejo = p("2021-03-01", "2021-03-02 18:40");
    expect(componer([p("2021-03-17", "2021-03-17 18:04"), viejo, p("2021-03-12", "2021-03-12 19:11")])).toEqual({
      masVieja: viejo, masReciente: "2021-03-17", mezcladas: true, fuentes: ["yahoo"],
    });
  });

  it("todos del mismo día: sin aviso; de dos del mismo día, el traído antes", () => {
    const antes = p("2027-03-17", "2027-03-17 08:13");
    expect(componer([p("2027-03-17", "2027-03-17 18:04"), antes])).toEqual({ masVieja: antes, masReciente: "2027-03-17", mezcladas: false, fuentes: ["yahoo"] });
  });

  it("uno sin la hora en que se trajo cuenta como el más viejo de su día", () => {
    const sinHora = p("2027-03-17", null);
    expect(componer([p("2027-03-17", "2027-03-17 08:13"), sinHora])?.masVieja).toBe(sinHora);
    expect(componer([sinHora, p("2027-03-16", "2027-03-17 08:13")])?.masVieja.dia).toBe("2027-03-16");
  });

  it("las fuentes sin repetir, en el orden de su código; sin fuente, al final", () => {
    const c = componer([p("2027-03-17", "2027-03-17 18:04", "yahoo"), p("2027-03-17", "2027-03-17 18:04", null), p("2027-03-17", "2027-03-17 18:04", "sfc:qhpu-8ixx"), p("2027-03-17", "2027-03-17 18:04", "yahoo")]);
    expect(c?.fuentes).toEqual(["sfc:qhpu-8ixx", "yahoo", null]);
  });

  it("no cambia la lista que recibe", () => {
    const entrada = Object.freeze([p("2027-03-17", "2027-03-17 18:04", "yahoo"), p("2021-03-01", "2021-03-02 18:40", "e2e-ficticio")].map((x) => Object.freeze(x)));
    const copia = JSON.stringify(entrada);
    componer(entrada);
    expect(JSON.stringify(entrada)).toBe(copia);
  });

  it("el resultado no depende del orden de la lista", () => {
    const lista = [p("2027-03-17", "2027-03-17 18:04"), p("2021-03-01", "2021-03-02 18:40", "e2e-ficticio"), p("2021-03-01", "2021-03-02 07:05", "sfc:x"), p("2027-01-04", null)];
    const esperado = componer(lista);
    expect(componer([...lista].reverse())).toEqual(esperado);
    expect(componer([lista[2]!, lista[0]!, lista[3]!, lista[1]!])).toEqual(esperado);
    expect(esperado?.masVieja).toEqual(p("2021-03-01", "2021-03-02 07:05", "sfc:x"));
  });
});
