import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";

const D = (v: string | number) => new Prisma.Decimal(v);
const especie = (o: Partial<EntradaEspecie> & { nemotecnico: string }): EntradaEspecie => ({
  instrumentoId: o.nemotecnico, cantidad: 0n, costoVivo: D(0), cierre: null, realizada: D(0), dividendos: D(0), comisiones: D(0), lotesVivos: 0, serie: [], ...o,
});
const cierre = (precio: number) => ({ precio: D(precio), fecha: new Date("2024-03-14T00:00:00Z"), verificado: false });

describe("calcularTablero", () => {
  const entradas = [
    especie({ nemotecnico: "AA", cantidad: 100n, costoVivo: D(1000), cierre: cierre(12), dividendos: D(30), comisiones: D(7) }),
    especie({ nemotecnico: "BB", cantidad: 50n, costoVivo: D(2000), cierre: cierre(37), comisiones: D(7) }),
    especie({ nemotecnico: "CC", cantidad: 0n, realizada: D(250), dividendos: D(15), comisiones: D(14) }),
  ];
  const t = calcularTablero(entradas);

  it("la ganancia total es exactamente sin vender + por ventas + dividendos − comisiones", () => {
    expect(t.sinVender.toString()).toBe("50"); // AA +200, BB −150
    expect(t.porVentas.toString()).toBe("250");
    expect(t.dividendos.toString()).toBe("45");
    expect(t.comisiones.toString()).toBe("28");
    expect(t.gananciaTotal.toString()).toBe("317");
    expect(t.gananciaTotal.equals(t.sinVender.add(t.porVentas).add(t.dividendos).sub(t.comisiones))).toBe(true);
  });

  it("valor, rentabilidad y peso de cada especie viva; los pesos suman 100", () => {
    expect(t.filas.map((f) => [f.nemotecnico, f.valor?.toString(), f.rentabilidadPct?.toFixed(1), f.pesoPct?.toFixed(2)])).toEqual([
      ["BB", "1850", "-7.5", "60.66"],
      ["AA", "1200", "20.0", "39.34"],
    ]);
    expect(t.filas.reduce((s, f) => s.add(f.pesoPct!), D(0)).toFixed(6)).toBe("100.000000");
    expect(t.valorAcciones.toString()).toBe("3050");
  });

  it("una especie vendida por completo no es una fila viva, pero su ganancia cuenta", () => {
    expect(t.cerradas.map((f) => f.nemotecnico)).toEqual(["CC"]);
    expect(t.filas.find((f) => f.nemotecnico === "CC")).toBeUndefined();
  });

  it("sin cierre, el valor queda sin dato (no se inventa) y se cuenta", () => {
    const s = calcularTablero([especie({ nemotecnico: "DD", cantidad: 10n, costoVivo: D(100) })]);
    expect(s.filas[0]!.valor).toBeNull();
    expect(s.especiesSinPrecio).toBe(1);
    expect(s.sinVender.toString()).toBe("0");
  });
});

describe("calcularTablero en los bordes", () => {
  it("sin entradas, todo en cero y sin filas", () => {
    const t = calcularTablero([]);
    expect([t.valorAcciones.toString(), t.gananciaTotal.toString(), t.especiesSinPrecio]).toEqual(["0", "0", 0]);
    expect([t.filas, t.cerradas]).toEqual([[], []]);
  });

  it("una especie viva sin cierre no tiene valor, ni sin vender, ni peso, y no contamina los totales", () => {
    const t = calcularTablero([
      especie({ nemotecnico: "AA", cantidad: 10n, costoVivo: D(100) }),
      especie({ nemotecnico: "BB", cantidad: 5n, costoVivo: D(50), cierre: cierre(20) }),
    ]);
    const aa = t.filas.find((f) => f.nemotecnico === "AA")!;
    expect([aa.valor, aa.sinVender, aa.pesoPct, aa.rentabilidadPct]).toEqual([null, null, null, null]);
    expect(t.valorAcciones.toString()).toBe("100"); // solo BB: 5 × 20
    expect(t.filas.find((f) => f.nemotecnico === "BB")!.pesoPct!.toString()).toBe("100");
    expect([t.sinVender.toString(), t.especiesSinPrecio]).toEqual(["50", 1]);
  });

  it("con costo vivo 0 la rentabilidad es nula (sin dividir por cero)", () => {
    const t = calcularTablero([especie({ nemotecnico: "AA", cantidad: 10n, costoVivo: D(0), cierre: cierre(3) })]);
    expect(t.filas[0]!.rentabilidadPct).toBeNull();
    expect(t.filas[0]!.sinVender!.toString()).toBe("30");
  });

  it("con pérdidas y comisiones la ganancia total queda negativa y sigue cuadrando", () => {
    const t = calcularTablero([especie({ nemotecnico: "AA", cantidad: 10n, costoVivo: D(200), cierre: cierre(10), realizada: D(-50), comisiones: D(20) })]);
    expect(t.gananciaTotal.toString()).toBe("-170"); // −100 − 50 − 20
  });
});

describe("calcularTablero · fecha de los cierres (nunca un precio viejo como de hoy)", () => {
  const el = (precio: number, iso: string, verificado = false) => ({ precio: D(precio), fecha: new Date(`${iso}T00:00:00Z`), verificado });
  const dias = (t: ReturnType<typeof calcularTablero>) => [t.fechaReferencia?.toISOString().slice(0, 10) ?? null, t.cierreMasViejo?.toISOString().slice(0, 10) ?? null];

  it("una viva con un cierre más viejo que la referencia queda atrasada y se cuenta; una cerrada más reciente no mueve la referencia", () => {
    const t = calcularTablero([
      especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000), cierre: el(120, "2027-10-29", true) }),
      especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: el(110, "2027-11-19") }),
      especie({ nemotecnico: "FICT8", cantidad: 0n, realizada: D(5), cierre: el(50, "2027-11-22") }),
    ]);
    expect(dias(t)).toEqual(["2027-11-19", "2027-10-29"]);
    expect(t.filas.map((f) => [f.nemotecnico, f.cierreAtrasado])).toEqual([["FICT1", true], ["FICT2", false]]);
    expect(t.cerradas.map((f) => f.cierreAtrasado)).toEqual([false]);
    expect(t.especiesAtrasadas).toBe(1);
  });

  it("la atrasada sigue en el valor y en la ganancia con su último precio negociado (se divulga, no se excluye)", () => {
    const t = calcularTablero([
      especie({ nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000), cierre: el(120, "2027-10-29") }),
      especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: el(110, "2027-11-19") }),
    ]);
    expect([t.valorAcciones.toString(), t.sinVender.toString(), t.gananciaTotal.toString(), t.especiesSinPrecio]).toEqual([D(10).mul(120).add(D(5).mul(110)).toString(), "250", "250", 0]); // 10 × 120 + 5 × 110
  });

  it("todas del mismo día: ninguna atrasada y la más vieja es la referencia", () => {
    const t = calcularTablero([
      especie({ nemotecnico: "FICT1", cantidad: 1n, cierre: el(1, "2027-11-19") }),
      especie({ nemotecnico: "FICT2", cantidad: 1n, cierre: el(2, "2027-11-19") }),
    ]);
    expect([t.especiesAtrasadas, ...dias(t)]).toEqual([0, "2027-11-19", "2027-11-19"]);
  });

  it("una viva sin cierre no es atrasada ni mueve las fechas; sin vivas con cierre no hay referencia", () => {
    const t = calcularTablero([
      especie({ nemotecnico: "FICT1", cantidad: 1n }),
      especie({ nemotecnico: "FICT2", cantidad: 1n, cierre: el(2, "2027-11-18") }),
    ]);
    expect([t.especiesAtrasadas, ...dias(t)]).toEqual([0, "2027-11-18", "2027-11-18"]);
    expect(t.filas.find((f) => f.nemotecnico === "FICT1")!.cierreAtrasado).toBe(false);
    const vacio = calcularTablero([especie({ nemotecnico: "FICT1", cantidad: 1n }), especie({ nemotecnico: "FICT8", cantidad: 0n, cierre: el(5, "2027-11-19") })]);
    expect([vacio.especiesAtrasadas, ...dias(vacio)]).toEqual([0, null, null]);
  });
});
