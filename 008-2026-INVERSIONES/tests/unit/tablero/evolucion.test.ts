// Evolución diaria del portafolio en acciones y TWR v1 (frente graficas-tablero). Cálculo puro, en Decimal.
// Datos inventados: especies FICT*, fechas de 2027 y números raros. Las cifras esperadas se escriben con la
// misma fórmula del método (r = (V + ventas + dividendos) / (V previo + compras) − 1), no con decimales a mano.
import { describe, expect, it } from "vitest";
import { METODO_TWR, calcularEvolucion, restarMeses, type EntradasEvolucion, type LoteEvolucion } from "@/tablero/evolucion";
import { D, dia } from "./ficticio";

const A = { id: "iA", nemo: "FICTA" };
const B = { id: "iB", nemo: "FICTB" };
const C = { id: "iC", nemo: "FICTC" };
type Esp = typeof A;

const lote = (id: string, e: Esp, f: string, cantidad: bigint, costo: string, flujo: string | null): LoteEvolucion => ({
  id, instrumentoId: e.id, fecha: dia(f), cantidad, costoTotal: D(costo), flujo: flujo === null ? null : D(flujo),
});
const cierres = (e: Esp, filas: readonly (readonly [string, string])[]) => filas.map(([f, p]) => ({ instrumentoId: e.id, fecha: dia(f), precio: D(p) }));
const entradas = (o: Partial<EntradasEvolucion>): EntradasEvolucion => ({
  especies: [A], lotes: [], ventas: [], dividendos: [], cierres: [], referencia: dia("2027-03-05"), ...o,
});
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const diez = (v: { toFixed(n: number): string }) => v.toFixed(10);

const L1 = lote("L1", A, "2027-03-01", 100n, "123700", "123791.37");
const CIERRES_A = cierres(A, [["2027-02-26", "1229.41"], ["2027-03-01", "1237"], ["2027-03-02", "1250.37"], ["2027-03-03", "1199.13"], ["2027-03-04", "1213.89"]]);

describe("calcularEvolucion · valor y costo por día", () => {
  it("un punto por día con cierre desde la primera tenencia: valor = cantidad × cierre; costo = el de lo que tiene", () => {
    const e = calcularEvolucion(entradas({ lotes: [L1], cierres: CIERRES_A, referencia: dia("2027-03-03") }));
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-02", "2027-03-03"]);
    expect(e.puntos.map((p) => p.valor.toString())).toEqual(["123700", "125037", "119913"]);
    expect(e.puntos.map((p) => p.costo.toString())).toEqual(["123700", "123700", "123700"]);
    expect(e.puntos[0]!.twr.isZero()).toBe(true);
    expect(diez(e.puntos[2]!.twr)).toBe(diez(D(119913).div(123700).sub(1)));
    expect(e.metodo).toBe(METODO_TWR);
    expect(METODO_TWR).toBe("twr-acciones-v1");
  });

  it("una compra entra al inicio del día: suma al denominador y su comisión resta", () => {
    const L2 = lote("L2", B, "2027-03-03", 37n, "46130.12", "46171.63");
    const e = calcularEvolucion(entradas({
      especies: [A, B], lotes: [L1, L2], referencia: dia("2027-03-03"),
      cierres: [...CIERRES_A, ...cierres(B, [["2027-03-03", "1260.05"]])],
    }));
    const v3 = D(100).mul("1199.13").add(D(37).mul("1260.05"));
    const esperado = D(125037).div(123700).mul(v3.div(D(125037).add("46171.63"))).sub(1);
    expect(e.puntos[2]!.valor.toString()).toBe(v3.toString());
    expect(e.puntos[2]!.costo.toString()).toBe("169830.12");
    expect(diez(e.puntos[2]!.twr)).toBe(diez(esperado));
  });

  it("una venta FIFO: su ingreso neto sale al cierre del día y el costo de lo que tiene baja en su costo FIFO", () => {
    const venta = { instrumentoId: A.id, fecha: dia("2027-03-03"), ingreso: D("49533.17"), asignaciones: [{ loteId: "L1", cantidad: 40n, costoBase: D(49480) }] };
    const e = calcularEvolucion(entradas({ lotes: [L1], ventas: [venta], cierres: CIERRES_A, referencia: dia("2027-03-03") }));
    const v3 = D(60).mul("1199.13");
    expect(e.puntos[2]!.valor.toString()).toBe(v3.toString());
    expect(e.puntos[2]!.costo.toString()).toBe("74220");
    expect(diez(e.puntos[2]!.twr)).toBe(diez(D(125037).div(123700).mul(v3.add("49533.17").div(125037)).sub(1)));
  });

  it("un lote agotado no aporta costo (lo que le sobre es redondeo), como en el tablero", () => {
    const venta = { instrumentoId: A.id, fecha: dia("2027-03-02"), ingreso: D("125012.47"), asignaciones: [{ loteId: "L1", cantidad: 100n, costoBase: D("123699.99") }] };
    const L2 = lote("L2", A, "2027-03-03", 7n, "8393.91", "8399.03");
    const e = calcularEvolucion(entradas({ lotes: [L1, L2], ventas: [venta], cierres: CIERRES_A, referencia: dia("2027-03-03") }));
    expect(e.puntos.map((p) => [iso(p.fecha), p.costo.toString()])).toEqual([["2027-03-01", "123700"], ["2027-03-02", "0"], ["2027-03-03", "8393.91"]]);
  });

  it("los dividendos (y las fracciones de escisión) son rendimiento del día en que se pagan", () => {
    const e = calcularEvolucion(entradas({
      lotes: [L1], cierres: CIERRES_A, referencia: dia("2027-03-02"),
      dividendos: [{ instrumentoId: A.id, fecha: dia("2027-03-02"), monto: D("371.13") }, { instrumentoId: A.id, fecha: dia("2027-02-26"), monto: D("47.11") }],
    }));
    expect(diez(e.puntos[1]!.twr)).toBe(diez(D(125037).add("371.13").div(123700).sub(1)));
  });

  it("un lote de escisión entra sin flujo de caja: el valor sube por las acciones nuevas y el costo salta con el del portal", () => {
    const LE = lote("LE", C, "2027-03-02", 13n, "4613", null);
    const e = calcularEvolucion(entradas({
      especies: [A, C], lotes: [L1, LE], referencia: dia("2027-03-02"),
      cierres: [...CIERRES_A, ...cierres(C, [["2027-03-02", "351.77"]])],
    }));
    const v2 = D(125037).add(D(13).mul("351.77"));
    expect(e.puntos[1]!.valor.toString()).toBe(v2.toString());
    expect(e.puntos[1]!.costo.toString()).toBe("128313");
    expect(diez(e.puntos[1]!.twr)).toBe(diez(v2.div(123700).sub(1)));
  });
});

describe("calcularEvolucion · días que no se grafican y especies que no entran", () => {
  it("un día en que una especie tenida no tiene ningún cierre todavía no se grafica: se cuenta, y su compra entra en el siguiente punto", () => {
    const L2 = lote("L2", B, "2027-03-02", 37n, "46130.12", "46171.63");
    const e = calcularEvolucion(entradas({
      especies: [A, B], lotes: [L1, L2], referencia: dia("2027-03-04"),
      cierres: [...CIERRES_A, ...cierres(B, [["2027-03-04", "1271.33"]])],
    }));
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-04"]);
    expect(e.omitidos).toBe(2);
    const v4 = D(100).mul("1213.89").add(D(37).mul("1271.33"));
    expect(diez(e.puntos[1]!.twr)).toBe(diez(v4.div(D(123700).add("46171.63")).sub(1)));
  });

  it("una especie sin ningún cierre no entra (ni valor, ni costo, ni flujos) y se informa por su nemotécnico", () => {
    const LC = lote("LC", C, "2027-03-02", 11n, "3719.47", "3722.61");
    const con = calcularEvolucion(entradas({ especies: [A, C], lotes: [L1, LC], cierres: CIERRES_A, referencia: dia("2027-03-03") }));
    const sin = calcularEvolucion(entradas({ lotes: [L1], cierres: CIERRES_A, referencia: dia("2027-03-03") }));
    expect(con.sinCierre).toEqual(["FICTC"]);
    expect(sin.sinCierre).toEqual([]);
    expect(con.puntos.map((p) => [p.valor.toString(), p.costo.toString(), diez(p.twr)])).toEqual(sin.puntos.map((p) => [p.valor.toString(), p.costo.toString(), diez(p.twr)]));
  });

  it("una especie ilíquida se valora con su último cierre y el punto dice cuántas van con un cierre anterior", () => {
    const L2 = lote("L2", B, "2027-03-01", 37n, "46130.12", "46171.63");
    const e = calcularEvolucion(entradas({
      especies: [A, B], lotes: [L1, L2], referencia: dia("2027-03-03"),
      cierres: [...CIERRES_A, ...cierres(B, [["2027-03-01", "1246.76"]])],
    }));
    expect(e.puntos.map((p) => p.atrasadas)).toEqual([0, 1, 1]);
    expect(e.puntos[2]!.valor.toString()).toBe(D(119913).add(D(37).mul("1246.76")).toString());
  });

  it("un día en que ninguna especie tenida cerró no es un punto (sin información nueva) y no cuenta como omitido", () => {
    const e = calcularEvolucion(entradas({
      especies: [A, C], lotes: [L1], referencia: dia("2027-03-05"),
      cierres: [...cierres(A, [["2027-03-01", "1237"], ["2027-03-02", "1250.37"]]), ...cierres(C, [["2027-03-03", "351.77"]])],
    }));
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-02"]);
    expect(e.omitidos).toBe(0);
  });

  it("vender todo deja el valor en 0 (el día sigue en la serie); sin capital, el periodo rinde 0; la recompra rinde contra lo que costó", () => {
    const todo = { instrumentoId: A.id, fecha: dia("2027-03-02"), ingreso: D("124983.07"), asignaciones: [{ loteId: "L1", cantidad: 100n, costoBase: D(123700) }] };
    const L2 = lote("L2", A, "2027-03-04", 50n, "60694.5", "60741.12");
    const e = calcularEvolucion(entradas({ lotes: [L1, L2], ventas: [todo], cierres: CIERRES_A, referencia: dia("2027-03-04") }));
    expect(e.puntos.map((p) => [iso(p.fecha), p.valor.toString()])).toEqual([["2027-03-01", "123700"], ["2027-03-02", "0"], ["2027-03-03", "0"], ["2027-03-04", "60694.5"]]);
    const f2 = D("124983.07").div(123700);
    expect(diez(e.puntos[1]!.twr)).toBe(diez(f2.sub(1)));
    expect(diez(e.puntos[2]!.twr)).toBe(diez(f2.sub(1)));
    expect(diez(e.puntos[3]!.twr)).toBe(diez(f2.mul(D("60694.5").div("60741.12")).sub(1)));
  });

  it("sin capital y sin flujos el denominador es 0: el periodo rinde 0 (nunca divide por 0)", () => {
    const todo = { instrumentoId: A.id, fecha: dia("2027-03-02"), ingreso: D("124983.07"), asignaciones: [{ loteId: "L1", cantidad: 100n, costoBase: D(123700) }] };
    const LE = lote("LE", C, "2027-03-03", 13n, "4613", null);
    const e = calcularEvolucion(entradas({
      especies: [A, C], lotes: [L1, LE], ventas: [todo], referencia: dia("2027-03-03"),
      cierres: [...CIERRES_A.slice(0, 3), ...cierres(C, [["2027-03-03", "351.77"]])],
    }));
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-02", "2027-03-03"]);
    expect(e.puntos[1]!.valor.isZero()).toBe(true);
    expect(e.puntos[2]!.valor.toString()).toBe(D(13).mul("351.77").toString());
    expect(diez(e.puntos[2]!.twr)).toBe(diez(e.puntos[1]!.twr));
  });

  it("antes de la primera tenencia no hay puntos aunque haya cierres; una venta y su compra el mismo día no abren la serie", () => {
    const ida = { instrumentoId: A.id, fecha: dia("2027-03-01"), ingreso: D("123100.03"), asignaciones: [{ loteId: "L1", cantidad: 100n, costoBase: D(123700) }] };
    const e = calcularEvolucion(entradas({ lotes: [L1], ventas: [ida], cierres: CIERRES_A, referencia: dia("2027-03-04") }));
    expect(e.puntos).toEqual([]);
  });

  it("nada después de la referencia; sin referencia, ningún punto", () => {
    const e = calcularEvolucion(entradas({ lotes: [L1], cierres: CIERRES_A, referencia: dia("2027-03-02") }));
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-02"]);
    const vacia = calcularEvolucion(entradas({ lotes: [L1], cierres: CIERRES_A, referencia: null }));
    expect(vacia.puntos).toEqual([]);
    expect(vacia.rangos).toEqual([]);
  });

  it("no depende del orden en que llegan las filas", () => {
    const L2 = lote("L2", B, "2027-03-02", 37n, "46130.12", "46171.63");
    const cb = cierres(B, [["2027-03-02", "1255.41"], ["2027-03-03", "1260.05"]]);
    const base = { especies: [A, B], referencia: dia("2027-03-04") };
    const orden = calcularEvolucion(entradas({ ...base, lotes: [L1, L2], cierres: [...CIERRES_A, ...cb] }));
    const desorden = calcularEvolucion(entradas({ ...base, lotes: [L2, L1], cierres: [...cb].reverse().concat([...CIERRES_A].reverse()) }));
    expect(desorden.puntos.map((p) => [iso(p.fecha), p.valor.toString(), diez(p.twr)])).toEqual(orden.puntos.map((p) => [iso(p.fecha), p.valor.toString(), diez(p.twr)]));
  });

  it("una asignación a un lote que no existe a esa fecha es un error de datos (nunca un valor inventado)", () => {
    const venta = { instrumentoId: A.id, fecha: dia("2027-03-02"), ingreso: D("4613.07"), asignaciones: [{ loteId: "NO", cantidad: 3n, costoBase: D(3711) }] };
    expect(() => calcularEvolucion(entradas({ lotes: [L1], ventas: [venta], cierres: CIERRES_A }))).toThrow(/lote/);
  });
});

describe("calcularEvolucion · rangos", () => {
  // Días hábiles (lunes a viernes) del 4-ene al 31-mar-2027, con un precio inventado que sube y baja.
  const habiles: string[] = [];
  for (let t = Date.UTC(2027, 0, 4); t <= Date.UTC(2027, 2, 31); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) habiles.push(iso(d));
  }
  const precios = habiles.map((f, k) => [f, (1237 + 41 * Math.sin(k / 3) + 3 * k).toFixed(2)] as const);
  const e = calcularEvolucion(entradas({ lotes: [lote("LR", A, "2027-01-04", 19n, "23503", "23519.11")], cierres: cierres(A, precios), referencia: dia("2027-03-31") }));
  const rango = (clave: string) => e.rangos.find((r) => r.clave === clave)!;

  it("1M, 3M, 6M, 1A y Todo, contados desde el último punto (con el día del mes ajustado: 31-mar − 1 mes = 28-feb)", () => {
    expect(e.rangos.map((r) => r.clave)).toEqual(["1M", "3M", "6M", "1A", "TODO"]);
    expect([iso(rango("1M").desde), rango("1M").cubre]).toEqual(["2027-03-01", true]);
    expect(e.puntos[rango("1M").inicio]!.fecha).toEqual(rango("1M").desde);
    for (const clave of ["3M", "6M", "1A"]) expect([rango(clave).inicio, rango(clave).cubre]).toEqual([0, false]);
    expect([rango("TODO").inicio, rango("TODO").cubre, iso(rango("TODO").desde)]).toEqual([0, true, "2027-01-04"]);
  });

  it("la TWR de un rango es la del último punto sobre la de su primer punto (calculada en el servidor)", () => {
    const ultimo = e.puntos[e.puntos.length - 1]!;
    const inicio = e.puntos[rango("1M").inicio]!;
    expect(diez(rango("1M").twr)).toBe(diez(ultimo.twr.add(1).div(inicio.twr.add(1)).sub(1)));
    expect(diez(rango("TODO").twr)).toBe(diez(ultimo.twr));
  });
});

describe("restarMeses", () => {
  it("resta meses de calendario y ajusta el día al último del mes", () => {
    expect(iso(restarMeses(dia("2027-03-31"), 1))).toBe("2027-02-28");
    expect(iso(restarMeses(dia("2020-03-31"), 1))).toBe("2020-02-29");
    expect(iso(restarMeses(dia("2021-01-15"), 3))).toBe("2020-10-15");
    expect(iso(restarMeses(dia("2021-05-31"), 12))).toBe("2020-05-31");
  });
});
