// Dividendos por acción para la historia: el pago neto de Trii entre la tenencia del día (la base no guarda la
// fecha ex ni el valor por acción), los decretos sin pago recibido (valor bruto) y su lugar en la rejilla. Puro.
import { describe, expect, it } from "vitest";
import { VENTANA_EX_DIAS as VENTANA_DEL_PLAN } from "@/plan/dividendos";
import { dividendosPorAccion } from "@/proyecciones/dividendos";
import { armarHistoria } from "@/proyecciones/historia";
import { VENTANA_EX_DIAS } from "@/proyecciones/metodo";
import { accion, dia, diasHabiles, entradas, iso, serieGeometrica } from "./ficticio";

const COMPRA = [{ fecha: dia("2019-01-08"), cantidad: 1237n }];
const conDividendos = (extra: Parameters<typeof accion>[3]) => accion("a", 1237, [], { movimientos: COMPRA, ...extra });
const HOY = dia("2020-06-30");

describe("dividendosPorAccion", () => {
  it("la ventana de la fecha ex aproximada es la del plan", () => {
    expect(VENTANA_EX_DIAS).toBe(VENTANA_DEL_PLAN);
  });

  it("por acción = neto pagado / tenencia del día del pago", () => {
    const r = dividendosPorAccion(conDividendos({ dividendos: [{ fechaPago: dia("2019-11-13"), montoNeto: 733.19, decretadoId: null }] }), HOY);
    expect(r.pagos).toEqual([{ dia: "2019-11-13", porAccion: 733.19 / 1237, origen: "PAGO" }]);
    expect(r.avisos).toEqual([]);
  });

  it("sin tenencia ese día, o con la tenencia cambiando en los días previos al pago: se omite y se avisa", () => {
    const r = dividendosPorAccion(
      conDividendos({
        movimientos: [...COMPRA, { fecha: dia("2019-11-08"), cantidad: 113n }],
        dividendos: [
          { fechaPago: dia("2019-01-04"), montoNeto: 41.37, decretadoId: null },
          { fechaPago: dia("2019-11-13"), montoNeto: 733.19, decretadoId: null },
          { fechaPago: dia("2019-12-11"), montoNeto: 802.61, decretadoId: null },
        ],
      }),
      HOY,
    );
    expect(r.pagos).toEqual([{ dia: "2019-12-11", porAccion: 802.61 / 1350, origen: "PAGO" }]);
    expect(r.avisos.map((a) => [a.codigo, a.dia])).toEqual([["DIVIDENDO_SIN_TENENCIA", "2019-01-04"], ["DIVIDENDO_TENENCIA_CAMBIA", "2019-11-13"]]);
  });

  it("decretos: sin pago recibido entra el valor bruto (con aviso); recibido, del mismo día o futuro, no se suma", () => {
    const r = dividendosPorAccion(
      conDividendos({
        dividendos: [{ fechaPago: dia("2019-11-13"), montoNeto: 733.19, decretadoId: null }],
        decretos: [
          { id: "d1", fechaPago: dia("2020-03-11"), valorPorAccion: 3.47, recibido: false },
          { id: "d2", fechaPago: dia("2019-08-14"), valorPorAccion: 2.91, recibido: true },
          { id: "d3", fechaPago: dia("2019-11-13"), valorPorAccion: 0.61, recibido: false },
          { id: "d4", fechaPago: dia("2027-04-14"), valorPorAccion: 3.13, recibido: false },
        ],
      }),
      HOY,
    );
    expect(r.pagos).toEqual([
      { dia: "2019-11-13", porAccion: 733.19 / 1237, origen: "PAGO" },
      { dia: "2020-03-11", porAccion: 3.47, origen: "DECRETO" },
    ]);
    expect(r.avisos.map((a) => [a.codigo, a.dia])).toEqual([["DECRETO_BRUTO", "2020-03-11"]]);
    expect(r.decretosFuturos).toBe(1);
  });
});

describe("dividendos en la historia", () => {
  const dias = diasHabiles("2019-01-02", 300);
  const cierres = serieGeometrica(dias, 1237.4, 1.0004);
  const precioEn = (d: string) => cierres.find((c) => iso(c.dia) === d)!.precio;

  it("un pago en sábado va al lunes siguiente, con rendimiento = D / P(día hábil anterior)", () => {
    const a = accion("a", 1237, cierres, { movimientos: COMPRA, dividendos: [{ fechaPago: dia("2019-11-16"), montoNeto: 733.19, decretadoId: null }] });
    const h = armarHistoria(entradas([a]));
    const j = h.historia.dias.indexOf("2019-11-18");
    expect(h.historia.rendimientos[j - 1]).toBeCloseTo(733.19 / 1237 / precioEn("2019-11-15"), 14);
    const otros = [...h.historia.rendimientos].filter((y, t) => t !== j - 1 && y !== 0);
    expect(otros).toEqual([]);
    expect(h.posiciones[0]).toMatchObject({ dividendosUsados: 1, primerDividendo: "2019-11-18" });
  });

  it("los pagos del primer día de la ventana o de antes, y los posteriores al último día, no entran", () => {
    const a = accion("a", 1237, cierres, {
      movimientos: [{ fecha: dia("2018-12-03"), cantidad: 1237n }],
      dividendos: [
        { fechaPago: dia("2018-12-19"), montoNeto: 41.37, decretadoId: null },
        { fechaPago: dias[0]!, montoNeto: 43.11, decretadoId: null },
        { fechaPago: dia("2020-05-13"), montoNeto: 47.93, decretadoId: null },
      ],
    });
    const h = armarHistoria(entradas([a], { hoy: HOY }));
    expect([...h.historia.rendimientos].every((y) => y === 0)).toBe(true);
    expect(h.posiciones[0]).toMatchObject({ dividendosUsados: 0, primerDividendo: null });
  });
});
