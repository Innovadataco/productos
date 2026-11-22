// Dividendos por acción para la historia: el pago neto de Trii entre la tenencia que lo cobró (sin decreto, la del día
// del pago; con decreto, la del día anterior a su fecha ex: la regla del plan, en dividendos-fecha-ex.test.ts), los
// decretos sin pago recibido (valor bruto) y su lugar en la rejilla. Puro.
import { describe, expect, it } from "vitest";
import { VENTANA_EX_DIAS as VENTANA_DEL_PLAN } from "@/plan/dividendos";
import { dividendosPorAccion } from "@/proyecciones/dividendos";
import { armarHistoria } from "@/proyecciones/historia";
import { VENTANA_EX_DIAS } from "@/proyecciones/metodo";
import { enVentanaDePago } from "@/datos-oficiales/decretos/ventana";
import { accion, azarDePrueba, dia, diasHabiles, entradas, iso, serieGeometrica, sumar } from "./ficticio";

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
          { id: "d1", fechaEx: dia("2020-03-04"), fechaPago: dia("2020-03-11"), valorPorAccion: 3.47, recibido: false },
          { id: "d2", fechaEx: dia("2019-08-07"), fechaPago: dia("2019-08-14"), valorPorAccion: 2.91, recibido: true },
          { id: "d3", fechaEx: dia("2019-11-06"), fechaPago: dia("2019-11-13"), valorPorAccion: 0.61, recibido: false },
          { id: "d4", fechaEx: dia("2027-04-07"), fechaPago: dia("2027-04-14"), valorPorAccion: 3.13, recibido: false },
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

describe("dividendosPorAccion · un decreto ya cruzado con su pago de Trii no se cuenta dos veces (C5b)", () => {
  /** Por omisión, la ex 7 días antes del pago: con la tenencia quieta desde la compra, la de antes de la ex es la del pago. */
  const decreto = (id: string, fechaPago: string, valorPorAccion = 0.61, fechaEx = iso(sumar(dia(fechaPago), -7))) =>
    ({ id, fechaEx: dia(fechaEx), fechaPago: dia(fechaPago), valorPorAccion, recibido: false });
  const pagoDe = (fechaPago: string, montoNeto = 733.19) => ({ fechaPago: dia(fechaPago), montoNeto, decretadoId: null });
  const origenes = (r: ReturnType<typeof dividendosPorAccion>) => r.pagos.map((p) => `${p.dia} ${p.origen}`);

  it("el pago que llega 2 días después del decreto: solo el PAGO, sin el bruto del decreto", () => {
    const r = dividendosPorAccion(conDividendos({ dividendos: [pagoDe("2019-11-15")], decretos: [decreto("d1", "2019-11-13")] }), HOY);
    expect(origenes(r)).toEqual(["2019-11-15 PAGO"]);
    expect(r.avisos).toEqual([]);
  });

  it("la ventana del cruce: un pago 3 días antes o 10 después lo cruza; 4 antes u 11 después, no (cuentan los dos)", () => {
    for (const [d, cruza] of [["2020-03-08", true], ["2020-03-21", true], ["2020-03-07", false], ["2020-03-22", false]] as const) {
      const r = dividendosPorAccion(conDividendos({ dividendos: [pagoDe(d)], decretos: [decreto("d1", "2020-03-11", 3.47)] }), HOY);
      expect(origenes(r), d).toEqual(cruza ? [`${d} PAGO`] : [d, "2020-03-11"].sort().map((x) => `${x} ${x === d ? "PAGO" : "DECRETO"}`));
    }
  });

  it("si el pago cruzado no entró a la historia (sin tenencia antes de la ex), el decreto entra con su bruto", () => {
    const sin = dividendosPorAccion(conDividendos({ dividendos: [pagoDe("2019-01-04", 41.37)], decretos: [decreto("d1", "2019-01-06")] }), HOY);
    expect(origenes(sin)).toEqual(["2019-01-06 DECRETO"]);
    expect(sin.avisos.map((a) => a.codigo)).toEqual(["DIVIDENDO_SIN_TENENCIA", "DECRETO_BRUTO"]);
  });

  it("CAMBIA con la regla del plan: una compra entre la ex del decreto y el pago ya no lo saca de la historia (antes, DIVIDENDO_TENENCIA_CAMBIA y el bruto)", () => {
    // La ex es el 6 y la compra el 8: con decreto manda la ex (src/plan/dividendos.ts), así que lo cobraron las 1.237 de
    // antes de la ex. Antes de este cambio, la compra en los VENTANA_EX_DIAS previos al pago lo dejaba fuera.
    const r = dividendosPorAccion(
      conDividendos({ movimientos: [...COMPRA, { fecha: dia("2019-11-08"), cantidad: 113n }], dividendos: [pagoDe("2019-11-13")], decretos: [decreto("d1", "2019-11-13")] }),
      HOY,
    );
    expect(r.pagos).toEqual([{ dia: "2019-11-13", porAccion: 733.19 / 1237, origen: "PAGO" }]);
    expect(r.avisos).toEqual([]);
  });

  // CAMBIAN con la regla del plan: un pago que cabe en dos ventanas no tiene una sola fecha ex (DECRETO_EN_DUDA en el
  // plan). Antes entraba con la tenencia del día del pago y cruzaba el grupo que elegía la asignación; ahora no entra y
  // los dos decretos entran con su bruto: ni doble conteo ni pérdida (la pantalla los marca PAGO_EN_DISPUTA).
  it("CAMBIA · dos decretos con ventanas que se tocan y sus dos pagos, los dos en las dos ventanas: ninguno entra y los dos decretos van con su bruto", () => {
    const r = dividendosPorAccion(
      conDividendos({ dividendos: [pagoDe("2020-01-15"), pagoDe("2020-01-20", 802.61)], decretos: [decreto("a", "2020-01-10"), decreto("b", "2020-01-17")] }),
      HOY,
    );
    expect(origenes(r)).toEqual(["2020-01-10 DECRETO", "2020-01-17 DECRETO"]);
    expect(r.avisos.map((a) => [a.codigo, a.dia])).toEqual([
      ["DIVIDENDO_DECRETO_EN_DUDA", "2020-01-15"], ["DIVIDENDO_DECRETO_EN_DUDA", "2020-01-20"], ["DECRETO_BRUTO", "2020-01-10"], ["DECRETO_BRUTO", "2020-01-17"],
    ]);
  });

  it("CAMBIA · dos decretos con ventanas que se tocan y un solo pago en las dos: no se elige; los dos decretos van con su bruto", () => {
    const r = dividendosPorAccion(conDividendos({ dividendos: [pagoDe("2020-01-15")], decretos: [decreto("a", "2020-01-10"), decreto("b", "2020-01-17", 2.13)] }), HOY);
    expect(origenes(r)).toEqual(["2020-01-10 DECRETO", "2020-01-17 DECRETO"]);
    expect(r.avisos.map((a) => a.codigo)).toEqual(["DIVIDENDO_DECRETO_EN_DUDA", "DECRETO_BRUTO", "DECRETO_BRUTO"]);
  });

  it("un decreto con pago futuro cuyo pago de Trii ya llegó (adelantado) no se cuenta como futuro", () => {
    const r = dividendosPorAccion(conDividendos({ dividendos: [pagoDe("2020-06-29")], decretos: [decreto("d1", "2020-07-02")] }), HOY);
    expect(origenes(r)).toEqual(["2020-06-29 PAGO"]);
    expect(r.decretosFuturos).toBe(0);
  });

  it("propiedad (semilla): sin ambigüedad, ni doble conteo ni pérdida; un pago nunca descarta más de una fecha de pago ni entra en disputa", () => {
    const azar = azarDePrueba(1237);
    // Fechas apretadas (150 días, las últimas 29 después de HOY) para que las ventanas se toquen a menudo y haya
    // decretos de pago futuro; los pagos de Trii, hasta HOY (el lector no trae los posteriores).
    const fecha = () => iso(sumar(dia("2020-03-01"), Math.floor(azar() * 150)));
    const fechaTrii = () => iso(sumar(dia("2020-03-01"), Math.floor(azar() * 122)));
    for (let caso = 0; caso < 500; caso += 1) {
      // La ex, de 0 a 24 días antes del pago del decreto (la base exige ex ≤ pago): unas veces antes del pago de Trii y
      // otras después (DIVIDENDO_DECRETO_EN_DUDA).
      const decretos = Array.from({ length: 1 + Math.floor(azar() * 5) }, (_, i) => {
        const pago = fecha();
        return decreto(`d${i}`, pago, 1 + azar(), iso(sumar(dia(pago), -Math.floor(azar() * 25))));
      });
      const dividendos = Array.from({ length: Math.floor(azar() * 6) }, () => pagoDe(fechaTrii(), 100 + azar() * 900));
      const movimientos = [...COMPRA, ...(azar() < 0.5 ? [{ fecha: dia(fecha()), cantidad: 113n }] : [])];
      const r = dividendosPorAccion(conDividendos({ dividendos, decretos, movimientos }), HOY);
      const entrados = r.pagos.filter((p) => p.origen === "PAGO").map((p) => dia(p.dia));
      const entroComoDecreto = new Set(r.pagos.filter((p) => p.origen === "DECRETO").map((p) => p.dia));
      const fechas = [...new Set(decretos.map((d) => iso(d.fechaPago)))].map(dia);
      const ventanasCon = (f: Date) => fechas.filter((g) => enVentanaDePago(g, f));
      const pasados = fechas.filter((g) => g <= HOY);
      for (const g of pasados) {
        const propios = entrados.filter((f) => enVentanaDePago(g, f));
        // (i) Ningún pago de la historia en su ventana: el decreto entra (no se pierde).
        if (propios.length === 0) expect(entroComoDecreto.has(iso(g)), `caso ${caso} · ${iso(g)} se perdió`).toBe(true);
        // (ii) Un pago de la historia que solo cabe en su ventana: el decreto no entra (no se cuenta dos veces).
        if (propios.some((f) => ventanasCon(f).length === 1)) expect(entroComoDecreto.has(iso(g)), `caso ${caso} · ${iso(g)} dos veces`).toBe(false);
      }
      // (v) Ningún pago que entró cabía en dos ventanas: en disputa no hay una sola fecha ex (la regla del plan).
      for (const f of entrados) expect(ventanasCon(f).length, `caso ${caso} · ${iso(f)} en disputa`).toBeLessThanOrEqual(1);
      // (iii) Cada pago de la historia descarta a lo sumo una fecha de pago de decretos.
      const descartadas = pasados.filter((g) => !entroComoDecreto.has(iso(g)));
      expect(descartadas.length, `caso ${caso}`).toBeLessThanOrEqual(entrados.length);
      // (iv) Los de pago futuro: cuenta todos los que no tienen un pago de la historia en su ventana, y nunca más que los futuros.
      const futuros = decretos.filter((d) => d.fechaPago > HOY);
      const futurosSinPago = futuros.filter((d) => !entrados.some((f) => enVentanaDePago(d.fechaPago, f)));
      expect(r.decretosFuturos, `caso ${caso}`).toBeGreaterThanOrEqual(futurosSinPago.length);
      expect(r.decretosFuturos, `caso ${caso}`).toBeLessThanOrEqual(futuros.length);
    }
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

  it("el aviso DECRETO_BRUTO solo sale para los decretos que entran a la ventana (revisión: el de antes no entra y no se avisa)", () => {
    const a = accion("a", 1237, cierres, {
      movimientos: COMPRA,
      decretos: [
        { id: "antes", fechaEx: dia("2018-12-12"), fechaPago: dia("2018-12-19"), valorPorAccion: 2.17, recibido: false },
        { id: "primero", fechaEx: dias[0]!, fechaPago: dias[0]!, valorPorAccion: 2.19, recibido: false },
        { id: "dentro", fechaEx: dia("2019-10-02"), fechaPago: dia("2019-10-09"), valorPorAccion: 3.47, recibido: false },
      ],
    });
    const h = armarHistoria(entradas([a]));
    expect(h.avisos.filter((x) => x.codigo === "DECRETO_BRUTO").map((x) => x.dia)).toEqual(["2019-10-09"]);
    expect(h.posiciones[0]).toMatchObject({ dividendosUsados: 1, primerDividendo: "2019-10-09" });
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
