// ¿El último cierre de una especie está al día? «Sin negociación desde…» (fase B, corte 3). Puro. Datos inventados.
import { describe, expect, it } from "vitest";
import { frescuraDelCierre, preciosAtrasados } from "@/plan/cierre-frescura";
import { leerCalendario } from "@/precios/negociacion";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Como calendario_bvc: 2024 sembrado con el festivo del lunes 4 de noviembre; 2030 sin sembrar.
const CALENDARIO = leerCalendario([
  { dia: dia("2024-01-01"), esHabil: false },
  { dia: dia("2024-11-04"), esHabil: false },
  { dia: dia("2024-11-11"), esHabil: false },
  { dia: dia("2024-12-25"), esHabil: false },
  { dia: dia("2025-01-01"), esHabil: false },
]);

describe("frescura del último cierre frente a la fecha de referencia", () => {
  it("sin ningún cierre: SIN_CIERRE", () => {
    expect(frescuraDelCierre(null, dia("2024-11-22"), CALENDARIO)).toEqual({ estado: "SIN_CIERRE" });
  });

  it("el cierre de la referencia está al día", () => {
    expect(frescuraDelCierre(dia("2024-11-22"), dia("2024-11-22"), CALENDARIO)).toEqual({ estado: "AL_DIA", ultimo: dia("2024-11-22") });
  });

  it("sin días hábiles entre el último cierre y la referencia sigue al día (fin de semana y festivo)", () => {
    // Viernes 1-nov → lunes 4 festivo: con referencia el 4 (una barra vieja de un día no hábil) no hubo rueda que faltara.
    expect(frescuraDelCierre(dia("2024-11-01"), dia("2024-11-04"), CALENDARIO)).toMatchObject({ estado: "AL_DIA" });
  });

  it("con días hábiles sin cierre: «sin negociación desde» el primer día hábil después del último cierre", () => {
    // 2 y 3 son fin de semana y el 4 es festivo: el primer día hábil sin cierre es el martes 5.
    expect(frescuraDelCierre(dia("2024-11-01"), dia("2024-11-22"), CALENDARIO)).toEqual({ estado: "SIN_NEGOCIACION", desde: dia("2024-11-05"), ultimo: dia("2024-11-01") });
    expect(frescuraDelCierre(dia("2024-11-21"), dia("2024-11-22"), CALENDARIO)).toEqual({ estado: "SIN_NEGOCIACION", desde: dia("2024-11-22"), ultimo: dia("2024-11-21") });
  });

  it("si el calendario no cubre un año del tramo, no se fecha: SIN_CALENDARIO con el año", () => {
    expect(frescuraDelCierre(dia("2029-12-28"), dia("2030-01-10"), CALENDARIO)).toEqual({ estado: "SIN_CALENDARIO", ultimo: dia("2029-12-28"), anio: 2029 });
    expect(frescuraDelCierre(dia("2024-12-31"), dia("2025-01-10"), CALENDARIO)).toMatchObject({ estado: "SIN_NEGOCIACION", desde: dia("2025-01-02") });
  });

  it("sin referencia (no hay cierres de las especies vivas) no se puede decir que esté atrasada", () => {
    expect(frescuraDelCierre(dia("2024-11-01"), null, CALENDARIO)).toEqual({ estado: "AL_DIA", ultimo: dia("2024-11-01") });
  });
});

describe("¿los precios se dejaron de actualizar?", () => {
  it("sí, si la referencia es anterior al último día hábil antes de hoy", () => {
    // Hoy martes 26-nov: el último día hábil anterior es el lunes 25.
    expect(preciosAtrasados(dia("2024-11-22"), dia("2024-11-26"), CALENDARIO)).toBe(true);
    expect(preciosAtrasados(dia("2024-11-25"), dia("2024-11-26"), CALENDARIO)).toBe(false);
  });

  it("no, si la referencia es el viernes y hoy es lunes, ni si el lunes anterior fue festivo", () => {
    expect(preciosAtrasados(dia("2024-11-22"), dia("2024-11-25"), CALENDARIO)).toBe(false);
    expect(preciosAtrasados(dia("2024-11-08"), dia("2024-11-12"), CALENDARIO)).toBe(false);
  });

  it("no se afirma sin calendario del año ni sin referencia", () => {
    expect(preciosAtrasados(dia("2030-01-02"), dia("2030-03-01"), CALENDARIO)).toBe(false);
    expect(preciosAtrasados(null, dia("2024-11-26"), CALENDARIO)).toBe(false);
  });
});
