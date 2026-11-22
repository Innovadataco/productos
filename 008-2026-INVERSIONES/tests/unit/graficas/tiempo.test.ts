// Días ISO y marcas del eje de tiempo (frente graficas-tablero): sin zonas horarias. Puro.
import { describe, expect, it } from "vitest";
import { diaANumero, numeroADia, ticksTiempo } from "@/app/_graficas/tiempo";

describe("diaANumero / numeroADia", () => {
  it("cuenta días enteros (UTC) y vuelve al mismo día; bisiestos incluidos", () => {
    expect(diaANumero("2027-03-01") - diaANumero("2027-02-28")).toBe(1);
    expect(diaANumero("2020-03-01") - diaANumero("2020-02-28")).toBe(2);
    expect(numeroADia(diaANumero("2027-11-16"))).toBe("2027-11-16");
  });
  it("un texto que no es día da NaN", () => {
    expect(diaANumero("16/11/2027")).toBeNaN();
  });
});

describe("ticksTiempo", () => {
  it("en un tramo largo marca comienzos de mes alineados al paso; el primero lleva el año", () => {
    const t = ticksTiempo(diaANumero("2027-01-04"), diaANumero("2027-12-20"), 6);
    expect(t.map((x) => x.dia)).toEqual(["2027-03-01", "2027-05-01", "2027-07-01", "2027-09-01", "2027-11-01"]);
    expect(t.map((x) => x.etiqueta)).toEqual([
      { tipo: "mes", conAnio: true }, { tipo: "mes", conAnio: false }, { tipo: "mes", conAnio: false }, { tipo: "mes", conAnio: false }, { tipo: "mes", conAnio: false },
    ]);
  });
  it("enero lleva el año; los años largos van de a 3, 6 o 12 meses", () => {
    const t = ticksTiempo(diaANumero("2020-02-10"), diaANumero("2021-10-05"), 5);
    expect(t.map((x) => x.dia)).toEqual(["2020-07-01", "2021-01-01", "2021-07-01"]);
    expect(t[1]!.etiqueta.conAnio).toBe(true);
  });
  it("en un tramo corto (hasta 70 días) marca días de a 7 o 14 desde el primero", () => {
    const t = ticksTiempo(diaANumero("2027-03-01"), diaANumero("2027-03-31"), 5);
    expect(t.map((x) => x.dia)).toEqual(["2027-03-01", "2027-03-08", "2027-03-15", "2027-03-22", "2027-03-29"]);
    expect(t[0]!.etiqueta).toEqual({ tipo: "dia", conAnio: true });
    expect(ticksTiempo(diaANumero("2027-03-01"), diaANumero("2027-04-30"), 5).map((x) => x.dia)).toEqual(["2027-03-01", "2027-03-15", "2027-03-29", "2027-04-12", "2027-04-26"]);
  });
  it("un tramo vacío o al revés no marca nada", () => {
    expect(ticksTiempo(10, 3, 5)).toEqual([]);
    expect(ticksTiempo(Number.NaN, 3, 5)).toEqual([]);
  });
});
