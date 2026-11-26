// Días hábiles de atraso de un cierre (frente fuente-retraso), según el calendario de la BVC. Fechas inventadas de 2027:
// el 22-mar es festivo y se siembra aquí; el 17-mar-2027 es miércoles. Las horas son de Colombia (UTC−5).
import { describe, expect, it } from "vitest";
import { atrasoParaAviso, diasHabilesDeAtraso } from "@/precios/atraso";
import type { CalendarioBvc } from "@/precios/negociacion";

const CAL: CalendarioBvc = { noHabiles: new Set(["2027-03-22"]), aniosCubiertos: new Set([2027]) };
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** El instante de las `hhmm` de Colombia de un día. */
const bogota = (iso: string, hhmm: string) => new Date(`${iso}T${hhmm}:00-05:00`);
const MIERCOLES = dia("2027-03-17");

describe("diasHabilesDeAtraso", () => {
  it("el mismo día o uno posterior al hoy: 0", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-17", "20:00"), CAL)).toBe(0);
    expect(diasHabilesDeAtraso(dia("2027-03-19"), bogota("2027-03-17", "10:00"), CAL)).toBe(0);
  });

  it("hoy solo cuenta cuando su rueda ya cerró (17:00 de Colombia)", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "10:00"), CAL)).toBe(0);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "16:59"), CAL)).toBe(0);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "17:00"), CAL)).toBe(1);
  });

  it("no cuenta fines de semana ni festivos del calendario", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-22", "10:00"), CAL)).toBe(2); // jue y vie; sáb, dom y festivo no
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "10:00"), CAL)).toBe(2); // el lunes festivo no suma
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)).toBe(3);
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-23", "10:00"), { ...CAL, noHabiles: new Set() })).toBe(3);
  });

  it("un año que el calendario no cubre no se fecha (null), y un cierre de hace más de diez años tampoco", () => {
    expect(diasHabilesDeAtraso(dia("2026-12-30"), bogota("2027-01-05", "10:00"), CAL)).toBeNull();
    expect(diasHabilesDeAtraso(dia("2010-01-04"), bogota("2027-03-17", "10:00"), CAL)).toBeNull();
  });

  it("no depende de la zona del proceso: usa el día de Colombia (23:30 allí ya es el día siguiente en UTC)", () => {
    expect(diasHabilesDeAtraso(MIERCOLES, bogota("2027-03-18", "23:30"), CAL)).toBe(1);
  });
});

describe("atrasoParaAviso", () => {
  it("avisa solo con más de un día hábil", () => {
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-18", "18:00"), CAL)).toBeNull();
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-19", "18:00"), CAL)).toBe(2);
    expect(atrasoParaAviso(MIERCOLES, bogota("2027-03-23", "18:00"), CAL)).toBe(3);
    expect(atrasoParaAviso(dia("2026-12-30"), bogota("2027-01-05", "10:00"), CAL)).toBeNull();
  });
});
