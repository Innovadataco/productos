// La historia real del valor antes de «Hoy» (frente proyecciones-pantalla): la evolución de las acciones del tablero
// más el fondo con sus unidades A ESA FECHA (no las de hoy) × su último valor de unidad, un punto por mes (el último
// día con dato de cada mes). Y la nota de hechos cuando la historia y el valor de hoy no empalman. Inventado.
import { describe, expect, it } from "vitest";
import { historiaMensual, notaDeSalto, type EntradasHistoria } from "@/app/proyecciones/historia";

const HOY = "2027-03-17";
const acciones = [
  { dia: "2027-01-04", valor: 4613.37 },
  { dia: "2027-01-29", valor: 4701.13 },
  { dia: "2027-02-01", valor: 4688.71 },
  { dia: "2027-02-26", valor: 4793.29 },
  { dia: "2027-03-12", valor: 4811.47 },
];
const sinFondo = (o: Partial<EntradasHistoria> = {}): EntradasHistoria => ({ acciones, fondos: [], hoy: HOY, ...o });

describe("historiaMensual", () => {
  it("un punto por mes: el último día con dato de cada mes (el último del todo incluido)", () => {
    expect(historiaMensual(sinFondo())).toEqual([
      { dia: "2027-01-29", valor: 4701.13 },
      { dia: "2027-02-26", valor: 4793.29 },
      { dia: "2027-03-12", valor: 4811.47 },
    ]);
  });

  it("solo hasta hoy: lo posterior no entra", () => {
    expect(historiaMensual(sinFondo({ hoy: "2027-02-27" })).map((p) => p.dia)).toEqual(["2027-01-29", "2027-02-26"]);
  });

  it("sin acciones ni fondo, la historia está vacía", () => {
    expect(historiaMensual(sinFondo({ acciones: [] }))).toEqual([]);
  });

  it("el fondo suma sus unidades a la fecha (el retiro resta) × el último valor de unidad hasta ese día", () => {
    const fondos = [{
      movimientos: [{ dia: "2027-01-05", unidades: 13.71 }, { dia: "2027-02-10", unidades: 4.13 }, { dia: "2027-03-01", unidades: -2.37 }],
      valores: [{ dia: "2027-01-03", valor: 101.37 }, { dia: "2027-01-28", valor: 103.11 }, { dia: "2027-02-27", valor: 104.79 }, { dia: "2027-03-11", valor: 105.31 }],
    }];
    const h = historiaMensual(sinFondo({ fondos }));
    const cerca = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
    cerca(h[0]!.valor, 4701.13 + 13.71 * 103.11);
    cerca(h[1]!.valor, 4793.29 + (13.71 + 4.13) * 103.11);
    cerca(h[2]!.valor, 4811.47 + (13.71 + 4.13 - 2.37) * 105.31);
  });

  it("un fondo sin valor de unidad todavía no suma (no se inventa su valor)", () => {
    const fondos = [{ movimientos: [{ dia: "2027-01-05", unidades: 13.71 }], valores: [{ dia: "2027-02-20", valor: 101.37 }] }];
    const h = historiaMensual(sinFondo({ fondos }));
    expect(h[0]!.valor).toBe(4701.13);
    expect(h[1]!.valor).toBeCloseTo(4793.29 + 13.71 * 101.37, 6);
  });

  it("solo desde `desde` (los años de historia que se leen): antes no hay valores del fondo y la serie caería sin motivo (hallazgo BAJO de code-reviewer)", () => {
    const fondos = [{ movimientos: [{ dia: "2027-01-05", unidades: 13.71 }], valores: [{ dia: "2027-02-20", valor: 101.37 }] }];
    expect(historiaMensual(sinFondo({ fondos, desde: "2027-02-01" })).map((p) => p.dia)).toEqual(["2027-02-26", "2027-03-12"]);
  });

  it("unidades que se compensan hasta casi cero (sumas en coma flotante) no valoran el fondo", () => {
    const fondos = [{ movimientos: [{ dia: "2027-01-05", unidades: 0.1 }, { dia: "2027-01-06", unidades: 0.2 }, { dia: "2027-01-07", unidades: -0.3 }], valores: [{ dia: "2027-01-10", valor: 101.37 }] }];
    expect(historiaMensual(sinFondo({ fondos }))[0]!.valor).toBe(4701.13);
    expect(historiaMensual(sinFondo({ acciones: [], fondos }))).toEqual([]);
  });

  it("sin evolución de acciones, los días salen de los valores del fondo mientras tiene unidades", () => {
    const fondos = [{
      movimientos: [{ dia: "2027-01-05", unidades: 13.71 }],
      valores: [{ dia: "2027-01-04", valor: 100.13 }, { dia: "2027-01-30", valor: 101.37 }, { dia: "2027-02-28", valor: 102.41 }, { dia: "2027-03-18", valor: 103.07 }],
    }];
    const h = historiaMensual(sinFondo({ acciones: [], fondos }));
    expect(h.map((p) => p.dia)).toEqual(["2027-01-30", "2027-02-28"]);
    expect(h[1]!.valor).toBeCloseTo(13.71 * 102.41, 6);
  });
});

describe("notaDeSalto", () => {
  const historia = [{ dia: "2027-03-12", valor: 4811.47 }];

  it("sin historia o con un empalme cercano (≤ 0,5 % y ≤ 7 días), no hay nota", () => {
    expect(notaDeSalto([], { hoy: HOY, valorHoy: 4811 })).toBeNull();
    expect(notaDeSalto(historia, { hoy: HOY, valorHoy: 4823 })).toBeNull();
  });

  it("con una diferencia de más de 0,5 % lo dice con las dos cifras y sus fechas, sin adivinar la causa", () => {
    const nota = notaDeSalto(historia, { hoy: HOY, valorHoy: 5137 });
    expect(nota).toContain("12-mar-2027");
    expect(nota).toContain("$ 4.811");
    expect(nota).toContain("17-mar-2027");
    expect(nota).toContain("$ 5.137");
  });

  it("con un hueco de más de 7 días entre el último dato y hoy también lo dice", () => {
    const nota = notaDeSalto([{ dia: "2027-02-26", valor: 4811.47 }], { hoy: HOY, valorHoy: 4811 });
    expect(nota).toContain("26-feb-2027");
  });
});
