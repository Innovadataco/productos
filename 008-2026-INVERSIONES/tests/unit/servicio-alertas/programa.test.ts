// El programa del servicio inv-008-alertas: la evaluación de las 18:15 COT (lunes a viernes) y, con el intradía encendido, cada 5
// minutos en la rueda (9:30 a 16:05 COT, con margen por el retraso del dato). Los festivos los mira el bucle con el calendario.
import { describe, expect, it } from "vitest";
import { cierreDeHoy, esRanuraDeCierre, proximaRanura, ranurasDelDia } from "@/servicio-alertas/programa";

const cot = (texto: string): Date => new Date(`${texto}:00.000-05:00`);
const iso = (d: Date): string => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 16);

describe("ranurasDelDia", () => {
  it("apagado el intradía: solo las 18:15", () => {
    expect(ranurasDelDia(false)).toEqual([18 * 60 + 15]);
  });

  it("encendido: de 9:30 a 16:05 cada 5 minutos (80 ranuras) y las 18:15", () => {
    const r = ranurasDelDia(true);
    expect(r).toHaveLength(81);
    expect(r[0]).toBe(9 * 60 + 30);
    expect(r[79]).toBe(16 * 60 + 5);
    expect(r[80]).toBe(18 * 60 + 15);
    for (let i = 1; i < 80; i += 1) expect(r[i]! - r[i - 1]!).toBe(5);
  });
});

describe("proximaRanura · intradía apagado", () => {
  it.each([
    ["2027-03-17T10:00", "2027-03-17T18:15"],
    ["2027-03-17T18:14", "2027-03-17T18:15"],
    ["2027-03-17T18:15", "2027-03-18T18:15"],
    ["2027-03-19T18:15", "2027-03-22T18:15"],
    ["2027-03-20T12:00", "2027-03-22T18:15"],
  ])("%s → %s", (ahora, esperada) => {
    expect(iso(proximaRanura(cot(ahora), false))).toBe(esperada);
  });
});

describe("proximaRanura · intradía encendido", () => {
  it.each([
    ["2027-03-17T09:00", "2027-03-17T09:30"],
    ["2027-03-17T09:30", "2027-03-17T09:35"],
    ["2027-03-17T12:07", "2027-03-17T12:10"],
    ["2027-03-17T16:00", "2027-03-17T16:05"],
    ["2027-03-17T16:05", "2027-03-17T18:15"],
    ["2027-03-17T18:15", "2027-03-18T09:30"],
    ["2027-03-19T18:15", "2027-03-22T09:30"],
    ["2027-03-20T10:00", "2027-03-22T09:30"],
  ])("%s → %s", (ahora, esperada) => {
    expect(iso(proximaRanura(cot(ahora), true))).toBe(esperada);
  });
});

describe("proximaRanura · bordes", () => {
  it("una fecha inválida lanza RangeError", () => {
    expect(() => proximaRanura(new Date(Number.NaN), false)).toThrow(RangeError);
  });
});

describe("cierreDeHoy y esRanuraDeCierre", () => {
  it("un día de semana: las 18:15 de ese día de Colombia; un sábado o domingo, null", () => {
    expect(iso(cierreDeHoy(cot("2027-03-17T20:00"))!)).toBe("2027-03-17T18:15");
    expect(iso(cierreDeHoy(cot("2027-03-17T07:00"))!)).toBe("2027-03-17T18:15");
    expect(cierreDeHoy(cot("2027-03-20T12:00"))).toBeNull();
    expect(cierreDeHoy(cot("2027-03-21T12:00"))).toBeNull();
  });

  it("solo las 18:15 es del cierre", () => {
    expect(esRanuraDeCierre(cot("2027-03-17T18:15"))).toBe(true);
    expect(esRanuraDeCierre(cot("2027-03-17T10:15"))).toBe(false);
    expect(esRanuraDeCierre(cot("2027-03-17T18:20"))).toBe(false);
  });
});
