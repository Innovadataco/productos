// SPEC-13 «nunca un precio viejo como de hoy»: por qué una barra de Yahoo NO es el cierre de su día.
// Una sola razón por barra, en orden: HORARIO > NO_HABIL > SIN_NEGOCIACION > SIN_CALENDARIO. Datos inventados.
import { describe, expect, it } from "vitest";
import { esDiaHabil } from "@/precios/horario";
import { aniosDelRango, leerCalendario, motivoOmision, type MotivoOmision } from "@/precios/negociacion";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
// Calendario ficticio de 2024: un miércoles festivo y un sábado marcado (raro) como hábil.
const CALENDARIO = leerCalendario([
  { dia: utc("2024-03-13"), esHabil: false },
  { dia: utc("2024-03-16"), esHabil: true },
]);
const DESPUES = new Date("2024-04-10T20:00:00Z"); // todas las barras de marzo ya son definitivas

describe("leerCalendario", () => {
  it("toma los no hábiles y los años que tienen al menos una fila", () => {
    expect([...CALENDARIO.noHabiles]).toEqual(["2024-03-13"]);
    expect([...CALENDARIO.aniosCubiertos]).toEqual([2024]);
  });
  it("sin filas no cubre ningún año", () => {
    expect(leerCalendario([]).aniosCubiertos.size).toBe(0);
  });
});

describe("aniosDelRango", () => {
  it("cubre los años completos que toca el rango (lo que se lee de calendario_bvc)", () => {
    expect(aniosDelRango(utc("2024-12-20"), utc("2025-01-05"))).toEqual({ gte: utc("2024-01-01"), lt: utc("2026-01-01") });
    expect(aniosDelRango(utc("2024-03-12"), utc("2024-03-12"))).toEqual({ gte: utc("2024-01-01"), lt: utc("2025-01-01") });
  });
});

describe("esDiaHabil", () => {
  it.each([
    ["2024-03-12", true], // martes
    ["2024-03-13", false], // festivo
    ["2024-03-16", false], // sábado, aunque el calendario diga hábil: gana el fin de semana
    ["2024-03-17", false], // domingo
  ])("%s → %s", (dia, esperado) => {
    expect(esDiaHabil(utc(dia), CALENDARIO.noHabiles)).toBe(esperado);
  });
});

describe("motivoOmision", () => {
  const casos: [string, string, number | null, MotivoOmision | null][] = [
    ["hábil con negociación", "2024-03-12", 1500, null],
    ["hábil con volumen null: se mantiene lo de hoy", "2024-03-12", null, null],
    ["hábil con volumen 0", "2024-03-12", 0, "SIN_NEGOCIACION"],
    ["festivo con volumen 0", "2024-03-13", 0, "NO_HABIL"],
    ["festivo con volumen null", "2024-03-13", null, "NO_HABIL"],
    ["festivo con volumen", "2024-03-13", 10, "NO_HABIL"],
    ["sábado marcado hábil", "2024-03-16", 10, "NO_HABIL"],
    ["domingo", "2024-03-17", 0, "NO_HABIL"],
    ["martes de un año sin calendario", "2019-03-12", 700, "SIN_CALENDARIO"],
    ["martes sin calendario con volumen null", "2019-03-12", null, "SIN_CALENDARIO"],
    ["martes sin calendario con volumen 0: hay certeza de que no hubo negociación", "2019-03-12", 0, "SIN_NEGOCIACION"],
    ["sábado de un año sin calendario", "2019-03-16", 700, "NO_HABIL"],
  ];
  it.each(casos)("%s", (_nombre, dia, volumen, esperado) => {
    expect(motivoOmision({ fecha: utc(dia), volumen }, DESPUES, CALENDARIO)).toBe(esperado);
  });

  it("la barra de hoy: antes de las 17:00 COT es HORARIO aunque tenga volumen 0; después, SIN_NEGOCIACION", () => {
    const barra = { fecha: utc("2024-03-12"), volumen: 0 };
    expect(motivoOmision(barra, new Date("2024-03-12T15:00:00Z"), CALENDARIO)).toBe("HORARIO"); // 10:00 COT
    expect(motivoOmision(barra, new Date("2024-03-12T22:30:00Z"), CALENDARIO)).toBe("SIN_NEGOCIACION"); // 17:30 COT
  });

  it("hoy festivo cuenta por HORARIO aunque ya pasó la hora (al día siguiente, NO_HABIL)", () => {
    const barra = { fecha: utc("2024-03-13"), volumen: 0 };
    expect(motivoOmision(barra, new Date("2024-03-13T23:00:00Z"), CALENDARIO)).toBe("HORARIO");
    expect(motivoOmision(barra, new Date("2024-03-14T23:00:00Z"), CALENDARIO)).toBe("NO_HABIL");
  });

  it("una barra futura es HORARIO", () => {
    expect(motivoOmision({ fecha: utc("2024-03-14"), volumen: 10 }, new Date("2024-03-12T22:30:00Z"), CALENDARIO)).toBe("HORARIO");
  });
});
