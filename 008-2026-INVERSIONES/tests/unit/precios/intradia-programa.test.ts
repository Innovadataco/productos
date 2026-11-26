// La ventana del segundo ciclo (lunes a viernes, hora de Colombia) y la espera ante un 429 (exponencial, con tope).
import { describe, expect, it } from "vitest";
import { MAXIMA_ESPERA_MS, diaCot, enVentanaIntradia, esperaTrasFallos } from "@/servicio-precios/programa";

const cot = (texto: string): number => new Date(`${texto.replace(" ", "T")}:00-05:00`).getTime();
const DESDE = 9 * 60 + 30;
const HASTA = 16 * 60 + 25;

describe("enVentanaIntradia", () => {
  it("dentro de [desde, hasta) de un día entre semana: sí (el límite inferior entra y el superior no)", () => {
    expect(enVentanaIntradia(cot("2027-02-09 09:30"), DESDE, HASTA)).toBe(true);
    expect(enVentanaIntradia(cot("2027-02-09 12:00"), DESDE, HASTA)).toBe(true);
    expect(enVentanaIntradia(cot("2027-02-09 16:24"), DESDE, HASTA)).toBe(true);
    expect(enVentanaIntradia(cot("2027-02-09 09:29"), DESDE, HASTA)).toBe(false);
    expect(enVentanaIntradia(cot("2027-02-09 16:25"), DESDE, HASTA)).toBe(false);
    expect(enVentanaIntradia(cot("2027-02-09 18:00"), DESDE, HASTA)).toBe(false);
  });

  it("sábado y domingo: nunca", () => {
    expect(enVentanaIntradia(cot("2027-02-13 12:00"), DESDE, HASTA)).toBe(false);
    expect(enVentanaIntradia(cot("2027-02-14 12:00"), DESDE, HASTA)).toBe(false);
    expect(enVentanaIntradia(cot("2027-02-15 12:00"), DESDE, HASTA)).toBe(true);
  });

  it("usa la hora de Colombia (UTC−5), no la de UTC: las 22:00 UTC del viernes son las 17:00 COT", () => {
    expect(enVentanaIntradia(Date.UTC(2027, 1, 12, 22, 0), DESDE, HASTA)).toBe(false);
    expect(enVentanaIntradia(Date.UTC(2027, 1, 12, 15, 0), DESDE, HASTA)).toBe(true); // 10:00 COT
    // 02:00 UTC del sábado es el viernes 21:00 COT: fuera de ventana, y el sábado UTC no engaña.
    expect(enVentanaIntradia(Date.UTC(2027, 1, 13, 2, 0), DESDE, HASTA)).toBe(false);
  });

  it("un instante que no es finito no está en ventana (no lanza)", () => {
    expect(enVentanaIntradia(Number.NaN, DESDE, HASTA)).toBe(false);
  });
});

describe("diaCot", () => {
  it("la fecha de Colombia del instante", () => {
    expect(diaCot(cot("2027-02-09 23:30"))).toBe("2027-02-09");
    expect(diaCot(Date.UTC(2027, 1, 10, 4, 30))).toBe("2027-02-09");
  });
});

describe("esperaTrasFallos (el reintento ante 429)", () => {
  const CICLO = 60_000;
  it("sin fallos seguidos no hay espera extra; cada fallo duplica el ciclo", () => {
    expect(esperaTrasFallos(0, CICLO)).toBe(0);
    expect(esperaTrasFallos(1, CICLO)).toBe(2 * CICLO);
    expect(esperaTrasFallos(2, CICLO)).toBe(4 * CICLO);
    expect(esperaTrasFallos(3, CICLO)).toBe(8 * CICLO);
  });

  it("con tope: nunca más de MAXIMA_ESPERA_MS, ni con muchos fallos ni con un contador enorme", () => {
    expect(MAXIMA_ESPERA_MS).toBe(15 * 60_000);
    expect(esperaTrasFallos(10, CICLO)).toBe(MAXIMA_ESPERA_MS);
    expect(esperaTrasFallos(10_000, CICLO)).toBe(MAXIMA_ESPERA_MS);
    expect(esperaTrasFallos(5, 3_600_000)).toBe(MAXIMA_ESPERA_MS);
  });
});
