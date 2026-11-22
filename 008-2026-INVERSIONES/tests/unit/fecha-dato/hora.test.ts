// La hora de Colombia de cada dato (frente fecha-hora-datos): el instante en que 008 trajo el dato, en America/Bogota.
// El servidor la calcula con el desfase fijo de UTC−5 (Colombia no tiene horario de verano); esta prueba la compara
// con Intl en America/Bogota en una barrida de instantes y comprueba que no depende de la zona horaria del proceso.
import { afterEach, describe, expect, it } from "vitest";
import { dateTimeColombia, horaColombia } from "@/app/_comun/fecha-dato/hora";

const BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** El mismo instante con Intl en America/Bogota: «AAAA-MM-DD HH:MM». */
function conIntl(d: Date): string {
  const p = Object.fromEntries(BOGOTA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const ZONA_ORIGINAL = process.env.TZ;
afterEach(() => {
  if (ZONA_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = ZONA_ORIGINAL;
});

describe("horaColombia", () => {
  it("pasa el instante a la hora de Colombia: las 23:04 UTC son las 18:04 del mismo día", () => {
    expect(horaColombia(new Date("2027-03-17T23:04:00Z"))).toBe("2027-03-17 18:04");
  });

  it("antes de las 05:00 UTC todavía es el día anterior en Colombia", () => {
    expect(horaColombia(new Date("2027-03-18T04:59:59Z"))).toBe("2027-03-17 23:59");
    expect(horaColombia(new Date("2027-03-18T05:00:00Z"))).toBe("2027-03-18 00:00");
    expect(horaColombia(new Date("2027-01-01T03:41:00Z"))).toBe("2026-12-31 22:41");
  });

  it("corta los segundos, no los redondea (las 18:04:59 siguen siendo las 18:04)", () => {
    expect(horaColombia(new Date("2027-03-17T23:04:59.999Z"))).toBe("2027-03-17 18:04");
  });

  it("coincide con Intl en America/Bogota en una barrida de instantes de 2000 a 2040", () => {
    const paso = 37 * 3_600_000 + 13 * 60_000 + 17_000;
    let comparados = 0;
    for (let t = Date.UTC(2000, 0, 1); t < Date.UTC(2041, 0, 1); t += paso) {
      const d = new Date(t);
      expect(horaColombia(d), d.toISOString()).toBe(conIntl(d));
      comparados += 1;
    }
    expect(comparados).toBeGreaterThan(9000);
  });

  it("no depende de la zona horaria del proceso (Tokio, Madrid o UTC dan lo mismo)", () => {
    const d = new Date("2027-03-17T23:04:00Z");
    const resultados = ["Asia/Tokyo", "Europe/Madrid", "UTC", "America/Bogota"].map((zona) => {
      process.env.TZ = zona;
      return horaColombia(d);
    });
    expect(new Set(resultados)).toEqual(new Set(["2027-03-17 18:04"]));
  });
});

describe("dateTimeColombia", () => {
  it("la hora de Colombia como atributo de <time>, con su desfase (−05:00)", () => {
    expect(dateTimeColombia("2027-03-17 18:04")).toBe("2027-03-17T18:04-05:00");
  });

  it("un texto que no es «AAAA-MM-DD HH:MM» no da atributo", () => {
    for (const malo of ["2027-03-17T18:04", "2027-03-17", "", "2027-03-17 18:04:00", "x 2027-03-17 18:04"]) expect(dateTimeColombia(malo), malo).toBeNull();
  });
});
