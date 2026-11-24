// El programa del servicio inv-008-ia: las ranuras son las horas que Jelk puede elegir en /edicion/ia (HORAS_RESUMEN), de
// lunes a viernes en hora de Colombia. El día hábil BVC (festivos) lo decide el bucle con el calendario de la base.
import { describe, expect, it } from "vitest";
import { HORAS_RESUMEN } from "@/ia/config/parametros";
import { horaDeRanura, proximaRanura } from "@/servicio-ia/programa";

const cot = (texto: string): Date => new Date(`${texto}:00.000-05:00`);

describe("proximaRanura", () => {
  it("la siguiente hora en punto de la lista, estrictamente después de ahora", () => {
    expect(proximaRanura(cot("2027-03-17T10:13"))).toEqual(cot("2027-03-17T18:00"));
    expect(proximaRanura(cot("2027-03-17T18:00"))).toEqual(cot("2027-03-17T19:00"));
    expect(proximaRanura(cot("2027-03-17T19:37"))).toEqual(cot("2027-03-17T20:00"));
  });

  it("después de la última del día, la primera del siguiente día de semana (salta sábado y domingo)", () => {
    expect(proximaRanura(cot("2027-03-17T21:00"))).toEqual(cot("2027-03-18T18:00"));
    expect(proximaRanura(cot("2027-03-19T21:41"))).toEqual(cot("2027-03-22T18:00"));
    expect(proximaRanura(cot("2027-03-20T09:07"))).toEqual(cot("2027-03-22T18:00"));
  });

  it("rechaza una fecha inválida", () => {
    expect(() => proximaRanura(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("horaDeRanura", () => {
  it("la hora de Colombia de la ranura, como la guarda config_ia", () => {
    for (const hora of HORAS_RESUMEN) expect(horaDeRanura(cot(`2027-03-17T${hora}`))).toBe(hora);
    expect(horaDeRanura(cot("2027-03-17T17:00"))).toBeNull();
  });
});
