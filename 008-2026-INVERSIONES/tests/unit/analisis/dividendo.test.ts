// Rendimiento por dividendo de 12 meses (con los bordes del intervalo, el bruto de un decreto y los pagos descartados)
// y la próxima fecha ex. Puro.
import { describe, expect, it } from "vitest";
import { proximaFechaEx, rendimientoDividendo12m } from "@/analisis/dividendo";
import { redondear } from "@/analisis/numeros";
import type { DecretoLeido } from "@/proyecciones/tipos";
import { accion, D, dia } from "./fixtures/portafolio.ficticio";

const HOY = dia("2021-06-15");
const compra = [{ fecha: dia("2019-01-02"), cantidad: 37n }];
const pago = (f: string, montoNeto: number) => ({ fechaPago: dia(f), montoNeto, decretadoId: null });
const decreto = (id: string, ex: string, pagoEl: string, valorPorAccion = 17.39): DecretoLeido => ({ id, fechaEx: dia(ex), fechaPago: dia(pagoEl), valorPorAccion, recibido: false });

describe("rendimiento por dividendo de 12 meses", () => {
  it("suma por acción los pagos en (hoy − 12 meses, hoy] y divide por el último cierre", () => {
    const a = accion("FICTICIA-A", 37, [], {
      movimientos: compra,
      dividendos: [pago("2020-06-15", 41.37), pago("2020-06-16", 41.37), pago("2021-03-10", 23.61), pago("2021-06-16", 5.13)],
    });
    expect(rendimientoDividendo12m(a, HOY, D("1237.4"))).toEqual({ fraccion: redondear((41.37 / 37 + 23.61 / 37) / 1237.4), pagos: 2, conBruto: false, descartados: 0 });
  });

  it("un decreto sin pago de Trii entra con su valor bruto y se marca", () => {
    const a = accion("FICTICIA-A", 37, [], { movimientos: compra, decretos: [decreto("FICTICIA-DEC-1", "2021-02-01", "2021-02-15")] });
    expect(rendimientoDividendo12m(a, HOY, D("1237.4"))).toEqual({ fraccion: redondear(17.39 / 1237.4), pagos: 1, conBruto: true, descartados: 0 });
  });

  it("un pago que no se sabe qué tenencia cobró queda fuera y se cuenta", () => {
    const a = accion("FICTICIA-A", 37, [], { movimientos: [{ fecha: dia("2021-01-04"), cantidad: 37n }], dividendos: [pago("2020-09-14", 41.37)] });
    expect(rendimientoDividendo12m(a, HOY, D("1237.4"))).toEqual({ fraccion: 0, pagos: 0, conBruto: false, descartados: 1 });
  });

  it("un descarte fuera de la ventana no cuenta", () => {
    const a = accion("FICTICIA-A", 37, [], { movimientos: [{ fecha: dia("2021-01-04"), cantidad: 37n }], dividendos: [pago("2019-09-16", 41.37)] });
    expect(rendimientoDividendo12m(a, HOY, D("1237.4")).descartados).toBe(0);
  });

  it("el último cierre debe ser positivo", () => {
    const a = accion("FICTICIA-A", 37, []);
    expect(() => rendimientoDividendo12m(a, HOY, D(0))).toThrow(RangeError);
  });
});

describe("próxima fecha ex", () => {
  it("la más próxima hoy o después; en un empate, por id; sin ninguna, null", () => {
    const a = accion("FICTICIA-A", 37, [], {
      decretos: [decreto("FICTICIA-DEC-9", "2021-06-28", "2021-07-12"), decreto("FICTICIA-DEC-3", "2021-06-21", "2021-07-06"), decreto("FICTICIA-DEC-2", "2021-06-21", "2021-07-06"), decreto("FICTICIA-DEC-1", "2021-06-14", "2021-06-30")],
    });
    expect(proximaFechaEx(a, HOY)).toEqual({ dia: "2021-06-21", decretoId: "FICTICIA-DEC-2" });
    expect(proximaFechaEx(accion("FICTICIA-A", 37, [], { decretos: [decreto("FICTICIA-DEC-1", "2021-06-15", "2021-06-30")] }), HOY)).toEqual({ dia: "2021-06-15", decretoId: "FICTICIA-DEC-1" });
    expect(proximaFechaEx(accion("FICTICIA-A", 37, [], { decretos: [decreto("FICTICIA-DEC-1", "2021-06-14", "2021-06-30")] }), HOY)).toBeNull();
  });
});
