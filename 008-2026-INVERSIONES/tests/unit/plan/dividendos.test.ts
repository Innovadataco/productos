// Dividendos atribuidos a un tramo de una decisión (fase B, corte 3). Puro. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { VENTANA_EX_DIAS, dividendosDelTramo, type ContextoEspecie, type DividendoPagado } from "@/plan/dividendos";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const div = (id: string, iso: string, monto: string, tipo: DividendoPagado["tipo"] = "ORDINARIO"): DividendoPagado => ({ id, fechaPago: dia(iso), montoNeto: D(monto), tipo });

const BASE = dia("2031-03-03");
const OBJETIVO = dia("2031-04-02");

const contexto = (cambios: Partial<ContextoEspecie> = {}): ContextoEspecie => ({
  dividendos: [],
  movimientos: [{ fecha: dia("2031-01-10"), cantidad: 100n }],
  cubiertoHasta: dia("2032-01-01"),
  destinoSinLote: false,
  escisiones: [],
  ...cambios,
});

describe("qué dividendos entran en el tramo", () => {
  it("los pagados en (base, objetivo]: el del día base no, el del día objetivo sí", () => {
    const r = dividendosDelTramo(contexto({ dividendos: [div("d0", "2031-03-03", "999"), div("d1", "2031-04-02", "1200"), div("d2", "2031-04-03", "999")] }), BASE, OBJETIVO, 50n);
    expect(r.medible).toBe(true);
    if (!r.medible) return;
    expect(r.atribuidos.map((a) => a.dividendoId)).toEqual(["d1"]);
    // 1.200 netos sobre 100 acciones = 12 por acción; 50 acciones → 600.
    expect(r.atribuidos[0]).toMatchObject({ tenencia: 100n });
    expect(r.atribuidos[0]?.porAccion.toString()).toBe("12");
    expect(r.atribuidos[0]?.atribuido.toString()).toBe("600");
    expect(r.total.toString()).toBe("600");
  });

  it("la fracción de una escisión no es dividendo (es ganancia realizada): no entra", () => {
    const r = dividendosDelTramo(contexto({ dividendos: [div("f", "2031-03-20", "500", "FRACCION_ESCISION")] }), BASE, OBJETIVO, 50n);
    expect(r).toMatchObject({ medible: true, atribuidos: [] });
  });

  it("los extraordinarios sí entran, y varios dividendos suman", () => {
    const r = dividendosDelTramo(contexto({ dividendos: [div("a", "2031-03-20", "100"), div("b", "2031-03-28", "300", "EXTRAORDINARIO")] }), BASE, OBJETIVO, 10n);
    expect(r.medible && r.total.toString()).toBe("40");
  });

  it("sin dividendos en la ventana es medible con total 0", () => {
    const r = dividendosDelTramo(contexto(), BASE, OBJETIVO, 10n);
    expect(r).toMatchObject({ medible: true, atribuidos: [] });
    expect(r.medible && r.total.isZero()).toBe(true);
  });

  it("multiplica antes de dividir y redondea a 4 decimales (mitad hacia arriba); el valor por acción, a 6", () => {
    const tres = contexto({ movimientos: [{ fecha: dia("2031-01-10"), cantidad: 3n }], dividendos: [div("d", "2031-03-20", "100")] });
    const uno = dividendosDelTramo(tres, BASE, OBJETIVO, 1n);
    const dos = dividendosDelTramo(tres, BASE, OBJETIVO, 2n);
    expect(uno.medible && uno.atribuidos[0]?.atribuido.toString()).toBe("33.3333");
    expect(dos.medible && dos.atribuidos[0]?.atribuido.toString()).toBe("66.6667");
    expect(uno.medible && uno.atribuidos[0]?.porAccion.toString()).toBe("33.333333");
  });
});

describe("cuándo no se pueden medir (todo el tramo queda sin dividendos, con su motivo)", () => {
  it("SIN_TENENCIA: no había acciones, o se vendieron todas dentro de la ventana", () => {
    expect(dividendosDelTramo(contexto({ movimientos: [] }), BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "SIN_TENENCIA" });
    const vendioTodo = contexto({ movimientos: [{ fecha: dia("2031-01-10"), cantidad: 100n }, { fecha: dia("2031-03-10"), cantidad: -100n }] });
    expect(dividendosDelTramo(vendioTodo, BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "SIN_TENENCIA" });
  });

  it(`TENENCIA_CAMBIA_CERCA_DEL_PAGO: una compra o venta en los ${VENTANA_EX_DIAS} días anteriores al pago`, () => {
    const cerca = contexto({ movimientos: [{ fecha: dia("2031-01-10"), cantidad: 100n }, { fecha: dia("2031-03-15"), cantidad: 20n }], dividendos: [div("d", "2031-03-20", "120")] });
    expect(dividendosDelTramo(cerca, BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" });
    const justoAntes = contexto({ movimientos: [{ fecha: dia("2031-01-10"), cantidad: 100n }, { fecha: dia("2031-03-10"), cantidad: 20n }], dividendos: [div("d", "2031-03-20", "120")] });
    expect(dividendosDelTramo(justoAntes, BASE, OBJETIVO, 10n).medible).toBe(true);
  });

  it("CARGA_NO_CUBRE: el objetivo es posterior a lo que llegan las cargas de Trii (o no hay cargas)", () => {
    expect(dividendosDelTramo(contexto({ cubiertoHasta: dia("2031-04-01") }), BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "CARGA_NO_CUBRE" });
    expect(dividendosDelTramo(contexto({ cubiertoHasta: null }), BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "CARGA_NO_CUBRE" });
    expect(dividendosDelTramo(contexto({ cubiertoHasta: OBJETIVO }), BASE, OBJETIVO, 10n).medible).toBe(true);
  });

  it("ESCISION_SIN_LOTE: la especie salió de una escisión cuyo lote no está registrado", () => {
    expect(dividendosDelTramo(contexto({ destinoSinLote: true }), BASE, OBJETIVO, 10n)).toEqual({ medible: false, motivo: "ESCISION_SIN_LOTE" });
  });

  it("si hay varias razones, gana la que va primero: escisión, carga, tenencia y cambio cerca del pago", () => {
    const todo = contexto({ destinoSinLote: true, cubiertoHasta: null, movimientos: [] });
    expect(dividendosDelTramo(todo, BASE, OBJETIVO, 10n)).toMatchObject({ motivo: "ESCISION_SIN_LOTE" });
    expect(dividendosDelTramo({ ...todo, destinoSinLote: false }, BASE, OBJETIVO, 10n)).toMatchObject({ motivo: "CARGA_NO_CUBRE" });
  });
});
