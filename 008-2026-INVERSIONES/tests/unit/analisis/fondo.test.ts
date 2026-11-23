// El fondo FIC en el análisis (frente analisis-pantalla, A2), cambio ADITIVO: el valor del fondo y su peso en el
// portafolio entran como una entrada opcional; sin ella la salida no cambia (ni la clave). El riesgo, la concentración y
// las especies siguen siendo solo de las acciones. Portafolios inventados: ids FICTICIA-*, días de 2019 a 2021. Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { fondosDeHistoria } from "@/analisis/fondo";
import type { EntradasAnalisis } from "@/analisis/tipos";
import type { FondoEntrada } from "@/proyecciones/tipos";
import { D, dia, diasHabiles, portafolio, retornosRepetidos, serieDeRetornos, sumar } from "./fixtures/portafolio.ficticio";

const DIAS = diasHabiles("2019-01-02", 300);
const ACCION = { id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(DIAS, 1237.4, retornosRepetidos(299)) };
const fondo = (id: string, unidades: number, valores: readonly { readonly dia: Date; readonly valorUnidad: number }[]): FondoEntrada => ({
  tipo: "FONDO", instrumentoId: id, nombre: "Fondo ficticio", unidades, valores,
});

describe("fondosDeHistoria · el valor del fondo desde la historia de leerEntradas", () => {
  it("sin fondos en la historia: ninguno", () => {
    expect(fondosDeHistoria(portafolio([ACCION]).historia)).toEqual({ fondos: [], sinValor: [] });
  });

  it("unidades × el último valor de unidad en o antes de hoy, a dos decimales, con su día", () => {
    const e = portafolio([ACCION]);
    const valores = [{ dia: sumar(e.hoy, -9), valorUnidad: 13.71 }, { dia: sumar(e.hoy, -2), valorUnidad: 13.7429 }, { dia: sumar(e.hoy, 3), valorUnidad: 99.1 }];
    const historia = { ...e.historia, posiciones: [...e.historia.posiciones, fondo("FICTICIA-FIC", 4613.27, valores)] };
    const { fondos, sinValor } = fondosDeHistoria(historia);
    expect(sinValor).toEqual([]);
    expect(fondos).toHaveLength(1);
    expect(fondos[0]!.instrumentoId).toBe("FICTICIA-FIC");
    expect(fondos[0]!.valor.toString()).toBe(D(4613.27).mul(13.7429).toDecimalPlaces(2).toString());
    expect(fondos[0]!.dia).toEqual(sumar(e.hoy, -2));
  });

  it("un fondo sin valor de unidad hasta hoy no entra: queda en sinValor, por id", () => {
    const e = portafolio([ACCION]);
    const historia = { ...e.historia, posiciones: [...e.historia.posiciones, fondo("FICTICIA-FIC-B", 37.11, [{ dia: sumar(e.hoy, 4), valorUnidad: 13.7 }]), fondo("FICTICIA-FIC-A", 37.11, [])] };
    expect(fondosDeHistoria(historia)).toEqual({ fondos: [], sinValor: ["FICTICIA-FIC-A", "FICTICIA-FIC-B"] });
  });
});

describe("analizar · con el fondo como entrada opcional", () => {
  const base = portafolio([ACCION]);

  it("sin la entrada de fondos: la salida no trae la clave conFondo (los análisis de siempre no cambian)", () => {
    expect(Object.keys(analizar(base))).not.toContain("conFondo");
  });

  it("con fondos: el total, el peso de las acciones y el de cada fondo (suman 1), y el resto del análisis igual", () => {
    const valorFondo = D("37911.47");
    const e: EntradasAnalisis = { ...base, fondos: [{ instrumentoId: "FICTICIA-FIC", valor: valorFondo, dia: sumar(base.hoy, -2) }] };
    const a = analizar(e);
    const total = base.tablero.valorAcciones.add(valorFondo);
    expect(a.conFondo!.valorTotal.toString()).toBe(total.toString());
    expect(a.conFondo!.pesoAcciones).toBeCloseTo(base.tablero.valorAcciones.div(total).toNumber(), 8);
    expect(a.conFondo!.fondos).toEqual([{ instrumentoId: "FICTICIA-FIC", valor: valorFondo, dia: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), peso: expect.any(Number) }]);
    expect(a.conFondo!.pesoAcciones + a.conFondo!.fondos[0]!.peso).toBeCloseTo(1, 7);
    const { conFondo: _, ...resto } = a;
    expect(resto).toStrictEqual(analizar(base));
  });

  it("con la lista vacía: el total es el valor de las acciones y su peso 1", () => {
    const a = analizar({ ...base, fondos: [] });
    expect(a.conFondo).toEqual({ valorTotal: base.tablero.valorAcciones, pesoAcciones: 1, fondos: [] });
  });

  it("sin valor en acciones ni fondos: los pesos no se inventan (null)", () => {
    const vacio = portafolio([], { hoy: dia("2021-06-15") });
    expect(analizar({ ...vacio, fondos: [] }).conFondo).toEqual({ valorTotal: D(0), pesoAcciones: null, fondos: [] });
  });

  it.each([
    ["un valor que no es positivo", { instrumentoId: "FICTICIA-FIC", valor: D(0), dia: dia("2021-01-04") }],
    ["un día posterior a hoy", { instrumentoId: "FICTICIA-FIC", valor: D("37.11"), dia: sumar(base.hoy, 1) }],
    ["un día que no es fecha de negocio", { instrumentoId: "FICTICIA-FIC", valor: D("37.11"), dia: new Date(sumar(base.hoy, -1).getTime() + 3_600_000) }],
    ["el id de una especie del tablero", { instrumentoId: "FICTICIA-A", valor: D("37.11"), dia: sumar(base.hoy, -1) }],
  ])("rechaza %s", (_, f) => {
    expect(() => analizar({ ...base, fondos: [f] })).toThrow(RangeError);
  });

  it("rechaza un fondo repetido", () => {
    const f = { instrumentoId: "FICTICIA-FIC", valor: D("37.11"), dia: sumar(base.hoy, -1) };
    expect(() => analizar({ ...base, fondos: [f, f] })).toThrow(/repetido/);
  });
});
