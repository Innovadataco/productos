/**
 * Derivaciones de los armadores, cada una con sus casos: dirección (del signo), cercanía (CERCA si la distancia a la regla
 * es menor que 3 %), frescura (HOY, RECIENTE o ATRASADO con el calendario BVC; las series y el fondo con su propia
 * regla), calidad (según la fuente) y la forma canónica de las cifras. Días de 2027 y cifras inventadas.
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { compararDecimales, deDecimal, deNumero, deTextoDecimal, diaDe, diasEntre, menorDia, signoDe } from "@/ia/hechos/decimal";
import {
  ORIGENES_DATO, UMBRAL_CERCANIA_REGLA_PCT, calidadDe, cercaniaDeRegla, direccionDelSigno, direccionFrente, frescuraDeSerie, frescuraDelFondo,
  frescuraPorCalendario, peorFrescura,
} from "@/ia/hechos/derivar";
import { ErrorArmado } from "@/ia/hechos/errores";
import type { CalendarioBvc } from "@/precios/negociacion";
import { CALENDARIO, FESTIVO_2027 } from "./apoyo.ficticio";

const codigoDe = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorArmado) return e.codigo;
    throw e;
  }
  throw new Error("no lanzó");
};

describe("cifras canónicas", () => {
  it.each([
    ["37911.4700", "37911.47"], ["-0.000", "0"], ["4613", "4613"], ["4.30", "4.3"], ["-2.50", "-2.5"], ["0.0613", "0.0613"], ["007.10", "7.1"],
  ])("deTextoDecimal(%s) → %s", (texto, canonico) => {
    expect(deTextoDecimal(texto)).toBe(canonico);
  });

  it.each(["37.911,47", "1e5", "", "-", "4613.", ".47", " 47", "4613.27 "])("deTextoDecimal rechaza «%s» con DECIMAL_INVALIDO", (texto) => {
    expect(codigoDe(() => deTextoDecimal(texto))).toBe("DECIMAL_INVALIDO");
  });

  it("deDecimal usa la notación normal del Decimal, sin exponente ni ceros sobrantes", () => {
    expect(deDecimal(new Prisma.Decimal("37911.4700"))).toBe("37911.47");
    expect(deDecimal(new Prisma.Decimal("0.00000004613"))).toBe("0.00000004613");
    expect(deDecimal(new Prisma.Decimal("4.613e+22"))).toBe("46130000000000000000000");
    expect(deDecimal(new Prisma.Decimal("-0"))).toBe("0");
  });

  it("una cifra de más de cuarenta caracteres no cabe en el contrato: DECIMAL_INVALIDO", () => {
    expect(codigoDe(() => deDecimal(new Prisma.Decimal(`0.${"0".repeat(45)}4613`)))).toBe("DECIMAL_INVALIDO");
  });

  it.each<readonly [number, number, string]>([
    [41377.190000000002, 2, "41377.19"], [17.346000000000004, 4, "17.346"], [-0.0000001, 2, "0"], [3, 0, "3"], [-4613.275001, 2, "-4613.28"],
  ])("deNumero(%s, %s) → %s", (v, decimales, esperado) => {
    expect(deNumero(v, decimales)).toBe(esperado);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 4.613e21])("deNumero(%s) no es una cifra del contrato: NUMERO_INVALIDO", (v) => {
    expect(codigoDe(() => deNumero(v, 2))).toBe("NUMERO_INVALIDO");
  });

  it("signo y comparación exactos sobre el texto (sin pasar por Number)", () => {
    expect([signoDe("-0.01"), signoDe("0"), signoDe("4613.27")]).toEqual([-1, 0, 1]);
    expect(compararDecimales("2.99999999999999999999", "3")).toBe(-1);
    expect(compararDecimales("3", "3")).toBe(0);
    expect(compararDecimales("-41.3", "-41.29")).toBe(-1);
    expect(compararDecimales("12.1", "9.97")).toBe(1);
    expect(compararDecimales("-0.5", "0.4")).toBe(-1);
    expect(codigoDe(() => compararDecimales("4.613,27", "3"))).toBe("DECIMAL_INVALIDO");
  });

  it("días de negocio: el día ISO de una fecha a medianoche UTC, los días entre dos y el menor", () => {
    expect(diaDe(new Date("2027-03-17T00:00:00.000Z"))).toBe("2027-03-17");
    expect(codigoDe(() => diaDe(new Date("2027-03-17T13:00:00.000Z")))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => diaDe(new Date(Number.NaN)))).toBe("FECHA_INVALIDA");
    expect(diasEntre("2027-03-17", "2027-09-23")).toBe(190);
    expect(diasEntre("2027-03-17", "2027-01-29")).toBe(-47);
    expect(menorDia("2027-03-18", "2027-03-17")).toBe("2027-03-17");
    expect(menorDia("2019-06-14", "2027-03-17")).toBe("2019-06-14");
  });
});

describe("dirección: del signo", () => {
  it.each([["4613.27", "SUBE"], ["-0.01", "BAJA"], ["0", "IGUAL"]] as const)("direccionDelSigno(%s) → %s", (v, d) => {
    expect(direccionDelSigno(v)).toBe(d);
  });

  it("frente a una referencia: el signo de la diferencia; sin referencia, NO_APLICA", () => {
    expect(direccionFrente("4137.19", "4129.53")).toBe("SUBE");
    expect(direccionFrente("4129.53", "4137.19")).toBe("BAJA");
    expect(direccionFrente("4137.19", "4137.19")).toBe("IGUAL");
    expect(direccionFrente("4137.19", null)).toBe("NO_APLICA");
  });
});

describe("cercanía: CERCA si la distancia a la regla es menor que 3 %", () => {
  it("el umbral es 3 (por ciento), del plan de la fase E", () => {
    expect(UMBRAL_CERCANIA_REGLA_PCT).toBe("3");
  });

  it.each([
    ["2.99", "CERCA"], ["-2.99", "CERCA"], ["0", "CERCA"], ["-0.01", "CERCA"], ["3", "LEJOS"], ["-3", "LEJOS"], ["3.01", "LEJOS"], ["-41.37", "LEJOS"],
    ["2.99999999999999999999", "CERCA"],
  ] as const)("cercaniaDeRegla(%s) → %s", (d, c) => {
    expect(cercaniaDeRegla(d)).toBe(c);
  });
});

describe("frescura con el calendario BVC", () => {
  it("el mismo día es HOY", () => {
    expect(frescuraPorCalendario("2027-03-17", "2027-03-17", CALENDARIO)).toEqual({ frescura: "HOY", calendarioCubre: true });
  });

  it("sin días hábiles entre el dato y hoy es RECIENTE (la rueda anterior, o del viernes al lunes)", () => {
    expect(frescuraPorCalendario("2027-03-16", "2027-03-17", CALENDARIO).frescura).toBe("RECIENTE");
    expect(frescuraPorCalendario("2027-03-12", "2027-03-15", CALENDARIO).frescura).toBe("RECIENTE");
  });

  it("un festivo del calendario no cuenta como rueda: del viernes al martes después del festivo es RECIENTE", () => {
    expect(frescuraPorCalendario("2027-03-19", "2027-03-23", CALENDARIO).frescura).toBe("RECIENTE");
    const sinFestivo: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set([2027]) };
    expect(frescuraPorCalendario("2027-03-19", "2027-03-23", sinFestivo).frescura).toBe("ATRASADO");
    expect(CALENDARIO.noHabiles.has(FESTIVO_2027)).toBe(true);
  });

  it("con un día hábil en medio es ATRASADO", () => {
    expect(frescuraPorCalendario("2027-03-15", "2027-03-17", CALENDARIO)).toEqual({ frescura: "ATRASADO", calendarioCubre: true });
    expect(frescuraPorCalendario("2019-06-14", "2027-03-17", CALENDARIO).frescura).toBe("ATRASADO");
  });

  it("si el calendario no cubre un año del tramo, no se afirma que sea reciente: ATRASADO y lo dice", () => {
    const sinAnio: CalendarioBvc = { noHabiles: new Set(), aniosCubiertos: new Set([2027]) };
    expect(frescuraPorCalendario("2027-12-31", "2028-01-04", sinAnio)).toEqual({ frescura: "ATRASADO", calendarioCubre: false });
    // Solo un fin de semana en medio: no hace falta el calendario para saber que no hubo rueda.
    expect(frescuraPorCalendario("2027-12-31", "2028-01-03", sinAnio)).toEqual({ frescura: "RECIENTE", calendarioCubre: true });
  });

  it("un dato posterior a hoy o un día que no existe es un error, no una frescura", () => {
    expect(codigoDe(() => frescuraPorCalendario("2027-03-18", "2027-03-17", CALENDARIO))).toBe("FECHA_FUTURA");
    expect(codigoDe(() => frescuraPorCalendario("2027-02-30", "2027-03-17", CALENDARIO))).toBe("FECHA_INVALIDA");
  });
});

describe("frescura de las series oficiales y del fondo (su propia regla)", () => {
  it("una serie que vale hoy es HOY; al día pero sin cubrir hoy, RECIENTE; atrasada, ATRASADO; sin datos, no hay hecho", () => {
    expect(frescuraDeSerie({ estado: "AL_DIA", cubreHoy: true })).toBe("HOY");
    expect(frescuraDeSerie({ estado: "AL_DIA", cubreHoy: false })).toBe("RECIENTE");
    expect(frescuraDeSerie({ estado: "ATRASADA", cubreHoy: false })).toBe("ATRASADO");
    expect(frescuraDeSerie({ estado: "ATRASADA", cubreHoy: true })).toBe("ATRASADO");
    expect(frescuraDeSerie({ estado: "SIN_DATOS", cubreHoy: false })).toBeNull();
  });

  it("el fondo: HOY si es de hoy; atrasado (su aviso), ATRASADO; si no, RECIENTE (la SFC publica con rezago)", () => {
    expect(frescuraDelFondo("2027-03-17", "2027-03-17", false)).toBe("HOY");
    expect(frescuraDelFondo("2027-03-15", "2027-03-17", false)).toBe("RECIENTE");
    expect(frescuraDelFondo("2027-03-15", "2027-03-17", true)).toBe("ATRASADO");
  });

  it("la peor de dos frescuras", () => {
    expect(peorFrescura("HOY", "RECIENTE")).toBe("RECIENTE");
    expect(peorFrescura("ATRASADO", "HOY")).toBe("ATRASADO");
    expect(peorFrescura("HOY", "HOY")).toBe("HOY");
  });
});

describe("calidad según la fuente", () => {
  it.each([
    ["REGISTRO", "VERIFICADO"], ["CIERRE_VERIFICADO", "VERIFICADO"], ["CIERRE_SIN_VERIFICAR", "NO_VERIFICADO"],
    ["PUBLICACION_OFICIAL", "VERIFICADO"], ["PLAN", "VERIFICADO"], ["DECRETO", "NO_VERIFICADO"], ["CALCULO", "CALCULADO"], ["ESTIMACION", "ESTIMADO"],
  ] as const)("%s, al día → %s", (origen, calidad) => {
    expect(calidadDe(origen, "RECIENTE")).toBe(calidad);
    expect(calidadDe(origen, "HOY")).toBe(calidad);
  });

  it("cualquier fuente con el dato atrasado es ATRASADO", () => {
    for (const origen of ORIGENES_DATO) expect(calidadDe(origen, "ATRASADO"), origen).toBe("ATRASADO");
  });

  it("la tabla cubre todos los orígenes y está congelada", () => {
    expect(ORIGENES_DATO).toHaveLength(8);
    expect(Object.isFrozen(ORIGENES_DATO)).toBe(true);
  });
});
