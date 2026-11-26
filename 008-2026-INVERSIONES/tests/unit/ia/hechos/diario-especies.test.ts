/**
 * El filtro de especies del armador DIARIO (T8): con la comparación del día entran las tres de mayor |aporte|; sin ella,
 * las tres de mayor valor; además, las de cierre atrasado; en total no más de `MAX_ESPECIES_DIARIO`. Si se dejó alguna
 * fuera, el paquete lo avisa (ESPECIES_RESUMIDAS). Las que entran quedan en el orden del tablero. Datos inventados.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { armarDiario, type EntradaArmadoDiario } from "@/ia/hechos";
import { VERSION_ARMADORES, CODIGOS_AVISO_ARMADO } from "@/ia/hechos/constantes";
import { MAX_ESPECIES_DIARIO } from "@/ia/hechos/diario";
import { D, dia, entradaDiarioFicticia, filasTablero } from "./apoyo.ficticio";

type Fila = ReturnType<typeof filasTablero>[number];

interface Especie {
  readonly nombre: string;
  readonly valor: string;
  /** null: sin movimiento (no entra al par de ruedas); si no, el aporte con su signo. */
  readonly aporte: string | null;
  readonly atrasada?: boolean;
}

const fila = (e: Especie): Fila => ({
  ...(filasTablero()[0] as Fila),
  instrumentoId: `inst-ficticio-${e.nombre.toLowerCase()}`, nemotecnico: `FICTICIA-${e.nombre}`, valor: D(e.valor),
  cierre: { precio: D("2713.9"), fecha: dia(e.atrasada === true ? "2027-03-15" : "2027-03-16"), verificado: true }, cierreAtrasado: e.atrasada === true,
});

/** La entrada con las especies dadas (en el orden dado: el del tablero) y, o no, la comparación del día. */
function entrada(especies: readonly Especie[], conComparacion = true): EntradaArmadoDiario {
  const base = entradaDiarioFicticia();
  const movidas = especies.filter((e) => e.aporte !== null);
  return {
    ...base,
    tablero: { ...base.tablero, filas: especies.map(fila) },
    movimiento: conComparacion
      ? { neto: D("-211.37"), motivo: null, especies: movidas.map((e) => ({ instrumentoId: `inst-ficticio-${e.nombre.toLowerCase()}`, aporte: D(e.aporte as string), variacionPct: new Prisma.Decimal("-0.8931") })) }
      : { neto: null, motivo: "SIN_RUEDA_PREVIA", especies: [] },
  };
}

const nombresDe = (e: EntradaArmadoDiario): readonly string[] =>
  armarDiario(e).hechos.filter((h) => h.clave === "ESPECIE_NOMBRE").map((h) => h.valor.replace("FICTICIA-", ""));
const avisosDe = (e: EntradaArmadoDiario): readonly string[] => armarDiario(e).avisos;

const SEIS: readonly Especie[] = [
  { nombre: "A", valor: "9000.5", aporte: "10.17" },
  { nombre: "B", valor: "8000.5", aporte: "-300.41" },
  { nombre: "C", valor: "7000.5", aporte: "20.13" },
  { nombre: "D", valor: "6000.5", aporte: "250.71" },
  { nombre: "E", valor: "5000.5", aporte: "-1.09" },
  { nombre: "F", valor: "4000.5", aporte: "100.37" },
];

describe("constantes", () => {
  it("el tope es cuatro, la versión de los armadores es la v2 y el aviso está en la lista cerrada", () => {
    expect(MAX_ESPECIES_DIARIO).toBe(4);
    expect(VERSION_ARMADORES).toBe("armadores-v2");
    expect([...CODIGOS_AVISO_ARMADO]).toContain("ESPECIES_RESUMIDAS");
  });
});

describe("con la comparación del día: las tres de mayor |aporte|", () => {
  it("entran B, D y F (aportes de 300, 250 y 100, con su signo ignorado), en el orden del tablero, y avisa", () => {
    const e = entrada(SEIS);
    expect(nombresDe(e)).toEqual(["B", "D", "F"]);
    expect(avisosDe(e)).toContain("ESPECIES_RESUMIDAS");
  });

  it("un empate de |aporte| lo desempata el orden del tablero (mayor valor primero)", () => {
    const empate: readonly Especie[] = SEIS.map((e) => ({ ...e, aporte: e.nombre === "A" ? "50.13" : e.nombre === "C" ? "-50.13" : e.nombre === "E" ? "50.13" : "1.01" }));
    expect(nombresDe(entrada(empate))).toEqual(["A", "C", "E"]);
  });

  it("una especie sin movimiento cuenta como aporte cero", () => {
    const sinMovimiento: readonly Especie[] = SEIS.map((e) => ({ ...e, aporte: e.nombre === "F" ? "0.37" : null }));
    expect(nombresDe(entrada(sinMovimiento))).toEqual(["A", "B", "F"]);
  });
});

describe("sin la comparación: las tres de mayor valor", () => {
  it("entran A, B y C, y avisa", () => {
    const e = entrada(SEIS, false);
    expect(nombresDe(e)).toEqual(["A", "B", "C"]);
    expect(avisosDe(e)).toContain("ESPECIES_RESUMIDAS");
  });

  it("aunque el tablero llegue desordenado, entran las de mayor valor y salen en el orden del tablero", () => {
    const e = entrada([...SEIS].reverse(), false);
    expect(nombresDe(e)).toEqual(["C", "B", "A"]);
  });
});

describe("además, las de cierre atrasado, hasta el tope de cuatro", () => {
  it("una atrasada fuera de las tres entra como cuarta (con comparación)", () => {
    const e = entrada(SEIS.map((x) => (x.nombre === "E" ? { ...x, aporte: null, atrasada: true } : x)));
    expect(nombresDe(e)).toEqual(["B", "D", "E", "F"]);
    expect(avisosDe(e)).toContain("ESPECIES_RESUMIDAS");
  });

  it("con dos atrasadas fuera, solo cabe una (la de mayor valor): el tope es cuatro", () => {
    const e = entrada(SEIS.map((x) => (x.nombre === "E" || x.nombre === "F" ? { ...x, aporte: null, atrasada: true } : x)), false);
    expect(nombresDe(e)).toEqual(["A", "B", "C", "E"]);
    expect(nombresDe(e)).toHaveLength(MAX_ESPECIES_DIARIO);
  });

  it("una atrasada que ya está entre las tres no suma otra", () => {
    const e = entrada(SEIS.map((x) => (x.nombre === "A" ? { ...x, atrasada: true } : x)), false);
    expect(nombresDe(e)).toEqual(["A", "B", "C"]);
  });
});

describe("sin descartar ninguna, no hay aviso", () => {
  it("tres especies o menos: entran todas y no avisa", () => {
    const e = entrada(SEIS.slice(0, 3));
    expect(nombresDe(e)).toEqual(["A", "B", "C"]);
    expect(avisosDe(e)).not.toContain("ESPECIES_RESUMIDAS");
  });

  it("cuatro especies, una atrasada fuera de las tres: entran las cuatro y no avisa", () => {
    const e = entrada(SEIS.slice(0, 4).map((x) => (x.nombre === "D" ? { ...x, aporte: null, atrasada: true } : x)), false);
    expect(nombresDe(e)).toEqual(["A", "B", "C", "D"]);
    expect(avisosDe(e)).not.toContain("ESPECIES_RESUMIDAS");
  });

  it("cuatro especies, ninguna atrasada: la cuarta se deja fuera y avisa", () => {
    const e = entrada(SEIS.slice(0, 4), false);
    expect(nombresDe(e)).toEqual(["A", "B", "C"]);
    expect(avisosDe(e)).toContain("ESPECIES_RESUMIDAS");
  });

  it("una especie sin cierre no cuenta como descartada (nunca iba al paquete)", () => {
    const base = entrada(SEIS.slice(0, 3));
    const sinCierre = { ...base, tablero: { ...base.tablero, filas: [...base.tablero.filas, { ...(filasTablero()[0] as Fila), instrumentoId: "inst-ficticio-z", nemotecnico: "FICTICIA-Z", valor: null, cierre: null }] } };
    expect(avisosDe(sinCierre as EntradaArmadoDiario)).not.toContain("ESPECIES_RESUMIDAS");
  });
});

describe("lo demás del paquete no cambia", () => {
  it("el portafolio, las series y el fondo salen completos aunque se resuman las especies, y es determinista", () => {
    const e = entrada(SEIS);
    const p = armarDiario(e);
    expect(p.hechos.some((h) => h.clave === "VALOR_ACCIONES" && h.obligatorio)).toBe(true);
    expect(p.hechos.some((h) => h.clave === "TASA_TRM")).toBe(true);
    expect(p.hechos.some((h) => h.clave === "FONDO_VALOR_UNIDAD")).toBe(true);
    expect(armarDiario(e)).toEqual(p);
    expect(p.versionesCalculo).toEqual({ hechos: "armadores-v2" });
  });

  it("los hechos de cada especie que entra son los de siempre (nombre, valor, peso, rentabilidad y cierre)", () => {
    const p = armarDiario(entrada(SEIS.slice(0, 1)));
    expect(p.hechos.filter((h) => h.clave.endsWith("_ESPECIE") || h.clave === "ESPECIE_NOMBRE").map((h) => h.clave)).toEqual([
      "ESPECIE_NOMBRE", "VALOR_ESPECIE", "PESO_ESPECIE", "RENTABILIDAD_ESPECIE", "CIERRE_ESPECIE", "VARIACION_DIA_ESPECIE",
    ]);
  });
});
