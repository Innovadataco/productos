// Resultado de una decisión a 30 y 90 días, con cierres guardados (fase B, corte 1). Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  MAX_RETROCESO_DIAS,
  VERSION_CALCULO,
  calcularResultado,
  calcularResultados,
  cierreEn,
  type Cierre,
  type EntradaResultado,
} from "@/plan/resultado";

const D = (v: string | number) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
let n = 0;
const cierre = (iso: string, precio: string, estado: Cierre["estado"] = "VERIFICADO"): Cierre => {
  n += 1;
  return { id: `c${n}`, fecha: dia(iso), precio: D(precio), estado, fuente: "yahoo" };
};
const orden = (id: string, iso: string, cantidad: bigint, totalEstimado: string) => ({
  id,
  fechaOperacion: dia(iso),
  cantidadCompletada: cantidad,
  totalEstimado: D(totalEstimado),
});

const HOY = dia("2032-01-15");

const noActuar = (cierres: Cierre[], cambios: Partial<EntradaResultado> = {}): EntradaResultado => ({
  accion: "NO_ACTUAR",
  fechaDecision: dia("2031-03-03"),
  cantidad: 50n,
  ordenes: [],
  cierres,
  hoy: HOY,
  ...cambios,
});

describe("cierre en una fecha", () => {
  const cierres = [cierre("2031-03-01", "10"), cierre("2031-03-05", "11"), cierre("2031-03-20", "12")];

  it("toma el último cierre en la fecha o antes", () => {
    expect(cierreEn(cierres, dia("2031-03-05"))?.precio.toString()).toBe("11");
    expect(cierreEn(cierres, dia("2031-03-08"))?.precio.toString()).toBe("11");
  });

  it(`no retrocede más de ${MAX_RETROCESO_DIAS} días`, () => {
    expect(cierreEn(cierres, dia("2031-03-12"))?.precio.toString()).toBe("11");
    expect(cierreEn(cierres, dia("2031-03-13"))).toBeNull();
    expect(cierreEn(cierres, dia("2031-02-28"))).toBeNull();
  });
});

describe("«no actuar»: cantidad × (P_h − P_0), desde la fecha de la decisión", () => {
  it("funcionó si el precio subió en el horizonte", () => {
    const r = calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-04-02", "10.5")]), 30);
    expect(r).toMatchObject({ horizonteDias: 30, estado: "CALCULADO", veredicto: "FUNCIONO", verificado: true, incluyeDividendos: false, versionCalculo: VERSION_CALCULO });
    expect(r.resultadoPesos?.toString()).toBe("25");
    expect(r.tramos).toHaveLength(1);
    expect(r.tramos[0]).toMatchObject({ ordenId: null, fechaBase: dia("2031-03-03"), fechaObjetivo: dia("2031-04-02") });
    expect(r.tramos[0]?.precioBase?.precio.toString()).toBe("10");
    expect(r.tramos[0]?.precioObjetivo?.precio.toString()).toBe("10.5");
  });

  it("no funcionó si bajó, y es neutro si quedó exactamente igual", () => {
    expect(calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-04-02", "9.98")]), 30)).toMatchObject({ veredicto: "NO_FUNCIONO" });
    const igual = calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-04-02", "10.000000")]), 30);
    expect(igual.veredicto).toBe("NEUTRO");
    expect(igual.resultadoPesos?.isZero()).toBe(true);
  });

  it("usa días calendario: el horizonte de 90 cae en su fecha y toma el cierre anterior si es fin de semana", () => {
    const r = calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-05-30", "8")]), 90);
    expect(r.tramos[0]?.fechaObjetivo).toEqual(dia("2031-06-01"));
    expect(r.tramos[0]?.precioObjetivo?.fecha).toEqual(dia("2031-05-30"));
    expect(r.resultadoPesos?.toString()).toBe("-100");
  });

  it("queda pendiente si la fecha objetivo es hoy o después (el cierre de hoy puede no estar)", () => {
    const enHoy = noActuar([cierre("2031-12-16", "10")], { fechaDecision: dia("2031-12-16") });
    expect(calcularResultado(enHoy, 30)).toMatchObject({ estado: "PENDIENTE", resultadoPesos: null, veredicto: null, verificado: false });
    expect(calcularResultado({ ...enHoy, hoy: dia("2032-01-16") }, 30).estado).not.toBe("PENDIENTE");
  });

  it("sin cierre base u objetivo dentro del retroceso queda SIN_PRECIO, sin cifra", () => {
    expect(calcularResultado(noActuar([cierre("2031-04-02", "10")]), 30)).toMatchObject({ estado: "SIN_PRECIO", resultadoPesos: null, veredicto: null });
    expect(calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-03-20", "10")]), 30)).toMatchObject({ estado: "SIN_PRECIO" });
  });

  it("marca no verificado si algún cierre usado no lo está", () => {
    const r = calcularResultado(noActuar([cierre("2031-03-03", "10"), cierre("2031-04-02", "11", "NO_VERIFICADO")]), 30);
    expect(r).toMatchObject({ estado: "CALCULADO", verificado: false });
  });

  it("sin cantidad no se puede medir (la base de datos ya lo impide)", () => {
    expect(() => calcularResultado(noActuar([], { cantidad: null }), 30)).toThrow(/CANTIDAD_FALTA/);
  });
});

describe("vender y comprar: se miden con las órdenes enlazadas, desde su ejecución", () => {
  const venta = (cierres: Cierre[], ordenes = [orden("o1", "2031-03-10", 100n, "993")]): EntradaResultado => ({
    accion: "VENDER",
    fechaDecision: dia("2031-03-07"),
    cantidad: null,
    ordenes,
    cierres,
    hoy: HOY,
  });

  it("vender: lo que entró neto de comisión − lo que valdría tenerlas (funcionó si bajó)", () => {
    const r = calcularResultado(venta([cierre("2031-04-09", "9")]), 30);
    expect(r.tramos[0]).toMatchObject({ ordenId: "o1", fechaBase: dia("2031-03-10"), fechaObjetivo: dia("2031-04-09"), precioBase: null });
    expect(r.resultadoPesos?.toString()).toBe("93");
    expect(r.veredicto).toBe("FUNCIONO");
    expect(calcularResultado(venta([cierre("2031-04-09", "11")]), 30).resultadoPesos?.toString()).toBe("-107");
  });

  it("comprar: lo que valen las acciones − lo que costaron con comisión", () => {
    const compra = { ...venta([cierre("2031-04-09", "11")], [orden("o2", "2031-03-10", 100n, "1007")]), accion: "COMPRAR" as const };
    const r = calcularResultado(compra, 30);
    expect(r.resultadoPesos?.toString()).toBe("93");
    expect(r.veredicto).toBe("FUNCIONO");
  });

  it("varias ejecuciones parciales suman, cada una desde su fecha y con la cantidad completada", () => {
    const r = calcularResultado(
      venta([cierre("2031-04-09", "9"), cierre("2031-04-14", "8")], [orden("o1", "2031-03-10", 100n, "993"), orden("o3", "2031-03-15", 40n, "393")]),
      30,
    );
    expect(r.tramos.map((t) => [t.ordenId, t.fechaObjetivo.toISOString().slice(0, 10), t.resultadoPesos?.toString()])).toEqual([
      ["o1", "2031-04-09", "93"],
      ["o3", "2031-04-14", "73"],
    ]);
    expect(r.resultadoPesos?.toString()).toBe("166");
  });

  it("sin órdenes enlazadas queda SIN_ORDEN", () => {
    expect(calcularResultado(venta([cierre("2031-04-09", "9")], []), 30)).toMatchObject({ estado: "SIN_ORDEN", resultadoPesos: null, tramos: [] });
  });

  it("si un tramo no tiene precio, todo queda SIN_PRECIO; si solo falta tiempo, PENDIENTE", () => {
    const dos = [orden("o1", "2031-03-10", 100n, "993"), orden("o4", "2031-12-30", 10n, "99")];
    expect(calcularResultado(venta([cierre("2031-04-09", "9")], dos), 30).estado).toBe("PENDIENTE");
    expect(calcularResultado(venta([], dos), 30).estado).toBe("SIN_PRECIO");
  });

  it("rotación: vender A y comprar B son dos decisiones; la suma da el efecto neto", () => {
    const a = calcularResultado(venta([cierre("2031-04-09", "9")]), 30);
    const b = calcularResultado({ ...venta([cierre("2031-04-09", "10.2")], [orden("o5", "2031-03-10", 97n, "992")]), accion: "COMPRAR" }, 30);
    expect(a.resultadoPesos!.add(b.resultadoPesos!).toString()).toBe("90.4");
  });
});

describe("los dos horizontes", () => {
  it("devuelve 30 y 90 días a la vez", () => {
    const r = calcularResultados(noActuar([cierre("2031-03-03", "10"), cierre("2031-04-02", "11"), cierre("2031-06-01", "9")]));
    expect(r.d30.resultadoPesos?.toString()).toBe("50");
    expect(r.d90.resultadoPesos?.toString()).toBe("-50");
    expect([r.d30.horizonteDias, r.d90.horizonteDias]).toEqual([30, 90]);
  });
});
