// Programa del servicio inv-008-precios (D-018): una corrida de lunes a viernes a las 18:00 COT (UTC−5 fijo,
// Colombia no tiene horario de verano), siempre la SIGUIENTE estrictamente después de «ahora». Fechas de 2027.
import { describe, expect, it } from "vitest";
import { HORA_CORRIDA_COT, proximaCorrida, textoCot } from "../../../src/servicio-precios/programa";

/** Instante a partir de la hora de Colombia: «2027-01-08 17:59» → 22:59 UTC. */
const cot = (texto: string): Date => new Date(`${texto.replace(" ", "T")}:00-05:00`);

describe("proximaCorrida", () => {
  it("la hora es las 18:00 COT", () => {
    expect(HORA_CORRIDA_COT).toEqual({ hora: 18, minuto: 0 });
  });

  // [ahora (COT), próxima (COT)] · 2027-01-08 es viernes; 2027-12-31 es viernes y 2028-01-03, lunes.
  for (const [ahora, esperada] of [
    ["2027-01-08 17:59", "2027-01-08 18:00"],
    ["2027-01-04 00:00", "2027-01-04 18:00"],
    ["2027-01-06 19:13", "2027-01-07 18:00"],
    ["2027-01-08 18:01", "2027-01-11 18:00"],
    ["2027-01-09 10:37", "2027-01-11 18:00"],
    ["2027-01-10 23:47", "2027-01-11 18:00"],
    ["2027-01-05 20:11", "2027-01-06 18:00"],
    ["2027-12-31 18:29", "2028-01-03 18:00"],
  ] as const) {
    it(`${ahora} COT → ${esperada} COT`, () => {
      expect(proximaCorrida(cot(ahora)).toISOString()).toBe(cot(esperada).toISOString());
    });
  }

  it("a las 18:00:00 exactas la de ese día ya no es la próxima (estrictamente después): sin dos corridas el mismo día", () => {
    expect(proximaCorrida(cot("2027-01-08 18:00")).toISOString()).toBe(cot("2027-01-11 18:00").toISOString());
    expect(proximaCorrida(new Date(cot("2027-01-07 18:00").getTime() - 1)).toISOString()).toBe(cot("2027-01-07 18:00").toISOString());
  });

  it("el día es el de Colombia, no el de UTC: el martes 20:11 COT ya es miércoles en UTC", () => {
    const martes = cot("2027-01-05 20:11");
    expect(martes.getUTCDay()).toBe(3);
    expect(proximaCorrida(martes).toISOString()).toBe("2027-01-06T23:00:00.000Z");
  });

  it("nunca cae en sábado ni domingo", () => {
    for (let t = cot("2027-03-01 00:07").getTime(); t < cot("2027-03-29 00:07").getTime(); t += 3 * 3_600_000 + 7 * 60_000) {
      const proxima = proximaCorrida(new Date(t));
      const dia = new Date(proxima.getTime() - 5 * 3_600_000).getUTCDay();
      expect(dia, proxima.toISOString()).toBeGreaterThanOrEqual(1);
      expect(dia, proxima.toISOString()).toBeLessThanOrEqual(5);
      expect(proxima.getTime()).toBeGreaterThan(t);
      expect(proxima.getTime() - t).toBeLessThanOrEqual(3 * 86_400_000);
    }
  });

  it("una fecha inválida lanza (no hay próxima corrida que calcular)", () => {
    expect(() => proximaCorrida(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("textoCot", () => {
  it("escribe el instante en hora de Colombia, al minuto", () => {
    expect(textoCot(new Date("2027-01-08T23:00:00.000Z"))).toBe("2027-01-08 18:00 COT");
    expect(textoCot(new Date("2027-01-09T04:59:59.999Z"))).toBe("2027-01-08 23:59 COT");
  });
});
