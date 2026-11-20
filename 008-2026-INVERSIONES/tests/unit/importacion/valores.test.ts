import { describe, expect, it } from "vitest";
import { leerCantidad, leerDecimal, leerFechaHoraTrii, leerFechaIso, leerNemotecnico } from "@/importacion/trii/valores";

const ok = <T>(r: { ok: boolean; valor?: T; codigo?: string }) => {
  if (!r.ok) throw new Error(`esperaba ok, llegó ${r.codigo}`);
  return r.valor as T;
};

describe("leerFechaHoraTrii (hora de Colombia, UTC−5)", () => {
  it("lee «12 may 2025, 4:42 p. m.» como 21:42 UTC", () => {
    const v = ok(leerFechaHoraTrii("12 may 2025, 4:42 p. m."));
    expect(v.instante.toISOString()).toBe("2025-05-12T21:42:00.000Z");
    expect(v.fecha.toISOString()).toBe("2025-05-12T00:00:00.000Z");
  });

  it.each([
    ["12 may 2025, 4:42 p. m.", "espacio sin separación"],
    ["12 may 2025, 4:42 p. m.", "espacio estrecho"],
    ["12 MAY. 2025, 4:42 P.M.", "mayúsculas y punto en el mes"],
    ["12 may 2025 4:42 pm", "sin coma ni puntos"],
  ])("acepta %j (%s)", (texto) => {
    expect(ok(leerFechaHoraTrii(texto)).instante.toISOString()).toBe("2025-05-12T21:42:00.000Z");
  });

  it("12:05 a. m. es medianoche y 12:30 p. m. es mediodía", () => {
    expect(ok(leerFechaHoraTrii("1 ene 2026, 12:05 a. m.")).instante.toISOString()).toBe("2026-01-01T05:05:00.000Z");
    expect(ok(leerFechaHoraTrii("1 ene 2026, 12:30 p. m.")).instante.toISOString()).toBe("2026-01-01T17:30:00.000Z");
  });

  it("una hora de la noche en Colombia sigue siendo el mismo día de negocio", () => {
    const v = ok(leerFechaHoraTrii("31 dic 2025, 11:59 p. m."));
    expect(v.instante.toISOString()).toBe("2026-01-01T04:59:00.000Z");
    expect(v.fecha.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it.each(["sept", "sep", "set"])("septiembre como «%s»", (mes) => {
    expect(ok(leerFechaHoraTrii(`3 ${mes} 2025, 9:30 a. m.`)).fecha.getUTCMonth()).toBe(8);
  });

  it.each([
    ["12 mayo 2025, 4:42 p. m.", "FECHA_MES_DESCONOCIDO"],
    ["31 abr 2025, 4:42 p. m.", "FECHA_HORA_INVALIDA"],
    ["12 may 2025, 13:42 p. m.", "FECHA_HORA_INVALIDA"],
    ["2025-05-12 16:42", "FECHA_HORA_FORMATO"],
    ["", "FECHA_HORA_FORMATO"],
  ])("rechaza %j con %s", (texto, codigo) => {
    expect(leerFechaHoraTrii(texto)).toEqual({ ok: false, codigo });
  });
});

describe("leerFechaIso", () => {
  it("lee 2026-10-19 y rechaza fechas imposibles o con hora", () => {
    expect(ok(leerFechaIso("2026-10-19")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(leerFechaIso("2026-02-30")).toEqual({ ok: false, codigo: "FECHA_INVALIDA" });
    expect(leerFechaIso("19/10/2026")).toEqual({ ok: false, codigo: "FECHA_FORMATO" });
  });
});

describe("leerDecimal", () => {
  it.each([
    ["23778.4", "23778.4"],
    ["1500", "1500"],
    ["0.35", "0.35"],
    ["007.50", "7.5"],
    ["1500.0", "1500"],
    ["0.10", "0.1"],
    ["-0.0", "0"],
    [" 12.5 ", "12.5"],
  ])("%j → %j", (texto, esperado) => {
    expect(ok(leerDecimal(texto))).toBe(esperado);
  });

  it.each(["1.234.567,00", "1,5", "$1500", "1e3", "", "abc"])("rechaza %j (no adivina formatos)", (texto) => {
    expect(leerDecimal(texto)).toEqual({ ok: false, codigo: "NUMERO_FORMATO" });
  });

  it("rechaza más decimales que la escala de la columna en vez de redondear en silencio", () => {
    expect(leerDecimal("100.00005")).toEqual({ ok: false, codigo: "NUMERO_PRECISION" });
    expect(ok(leerDecimal("100.0001"))).toBe("100.0001");
    expect(leerDecimal("33.3333333", 6)).toEqual({ ok: false, codigo: "NUMERO_PRECISION" });
    expect(ok(leerDecimal("33.333333", 6))).toBe("33.333333");
    expect(ok(leerDecimal("100.00050"))).toBe("100.0005"); // los ceros finales no cuentan
  });

  it("rechaza números que no caben en la columna", () => {
    expect(leerDecimal("12345678901234567")).toEqual({ ok: false, codigo: "NUMERO_RANGO" });
    expect(ok(leerDecimal("1234567890123456"))).toBe("1234567890123456");
  });
});

describe("leerCantidad", () => {
  it("lee «1412» y «1412/1412»", () => {
    expect(ok(leerCantidad("1412"))).toEqual({ completada: 1412n, solicitada: null });
    expect(ok(leerCantidad("1000/1412"))).toEqual({ completada: 1000n, solicitada: 1412n });
  });

  it("rechaza cantidades con decimales o completadas mayores que las solicitadas", () => {
    expect(leerCantidad("10.5")).toEqual({ ok: false, codigo: "CANTIDAD_FORMATO" });
    expect(leerCantidad("15/10")).toEqual({ ok: false, codigo: "CANTIDAD_INCOHERENTE" });
  });
});

describe("leerNemotecnico", () => {
  it("normaliza a mayúsculas y rechaza símbolos", () => {
    expect(ok(leerNemotecnico(" ficta "))).toBe("FICTA");
    expect(leerNemotecnico("FIC.CL")).toEqual({ ok: false, codigo: "NEMOTECNICO_FORMATO" });
  });
});
