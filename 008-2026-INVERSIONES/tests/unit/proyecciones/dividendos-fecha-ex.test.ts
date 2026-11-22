// El motor de proyecciones mide los pagos de Trii con la MISMA regla que el plan (src/plan/dividendos.ts, fase C, C5c).
// Con un decreto que cuenta cuya ventana de pago (src/datos-oficiales/decretos/ventana.ts, la del cruce) contiene el
// pago, manda su fecha ex: lo cobró la tenencia del cierre del día anterior a la ex (tenenciaAntesDeLaEx). Sin decreto,
// la aproximación de siempre (VENTANA_EX_DIAS). Cuando no se sabe qué acciones lo cobraron, el pago no entra a la
// historia, se avisa, y su decreto entra con su bruto (así no se pierde). Puro. Datos inventados, fechas antes de 2022.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { enVentanaDePago } from "@/datos-oficiales/decretos/ventana";
import { dividendosDelTramo, type MotivoSinDividendos } from "@/plan/dividendos";
import { constanteEn, tenenciaEn, type MovimientoTenencia } from "@/plan/tenencia";
import { dividendosPorAccion } from "@/proyecciones/dividendos";
import { VENTANA_EX_DIAS } from "@/proyecciones/metodo";
import type { CodigoAviso, DecretoLeido, DividendoLeido } from "@/proyecciones/tipos";
import { accion, azarDePrueba, dia, iso, sumar } from "./ficticio";

const HOY = dia("2020-06-30");
const mov = (fecha: string, cantidad: bigint): MovimientoTenencia => ({ fecha: dia(fecha), cantidad });
const COMPRA = mov("2019-01-08", 1237n);
const decreto = (id: string, ex: string, pago: string, valorPorAccion = 0.61): DecretoLeido =>
  ({ id, fechaEx: dia(ex), fechaPago: dia(pago), valorPorAccion, recibido: false });
const pago = (fechaPago: string, montoNeto = 733.19): DividendoLeido => ({ fechaPago: dia(fechaPago), montoNeto, decretadoId: null });
/** El decreto de siempre: ex el 6 y pago el 13 de noviembre; Trii paga el 13. */
const DECRETO = decreto("d", "2019-11-06", "2019-11-13");
const PAGO = pago("2019-11-13");

const medir = (cambios: { movimientos?: MovimientoTenencia[]; dividendos?: DividendoLeido[]; decretos?: DecretoLeido[] }, hoy = HOY) =>
  dividendosPorAccion(accion("a", 1237, [], { movimientos: [COMPRA], dividendos: [PAGO], decretos: [DECRETO], ...cambios }), hoy);
const entradas = (r: ReturnType<typeof dividendosPorAccion>) => r.pagos.map((p) => [p.dia, p.origen, p.porAccion]);
const avisos = (r: ReturnType<typeof dividendosPorAccion>) => r.avisos.map((a) => [a.codigo, a.dia]);

describe("con decreto, lo cobró la tenencia del cierre del día anterior a la ex", () => {
  it("una compra entre la ex y el pago ya no lo saca: el divisor es la tenencia antes de la ex", () => {
    const compraDespues = [COMPRA, mov("2019-11-08", 113n)];
    expect(avisos(medir({ movimientos: compraDespues, decretos: [] }))).toEqual([["DIVIDENDO_TENENCIA_CAMBIA", "2019-11-13"]]);
    const r = medir({ movimientos: compraDespues });
    expect(entradas(r)).toEqual([["2019-11-13", "PAGO", 733.19 / 1237]]);
    expect(r.avisos).toEqual([]);
  });

  it("la compra del día anterior a la ex entra al divisor; la del día de la ex, no", () => {
    expect(entradas(medir({ movimientos: [COMPRA, mov("2019-11-05", 113n)] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 1350]]);
    expect(entradas(medir({ movimientos: [COMPRA, mov("2019-11-06", 113n)] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 1237]]);
  });

  it("la venta del día anterior a la ex sale del divisor; la del día de la ex, no", () => {
    expect(entradas(medir({ movimientos: [COMPRA, mov("2019-11-05", -311n)] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 926]]);
    expect(entradas(medir({ movimientos: [COMPRA, mov("2019-11-06", -311n)] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 1237]]);
  });

  it("una compra después de la ex y más de VENTANA_EX_DIAS antes del pago: sin decreto contaba en el divisor; con él, no", () => {
    const exTemprana = decreto("d", "2019-10-23", "2019-11-13");
    const movimientos = [COMPRA, mov("2019-10-25", 113n)];
    expect(entradas(medir({ movimientos, decretos: [] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 1350]]);
    expect(entradas(medir({ movimientos, decretos: [exTemprana] }))).toEqual([["2019-11-13", "PAGO", 733.19 / 1237]]);
  });

  it("dos filas de Trii del mismo decreto usan el mismo divisor, aunque la tenencia cambie entre ellas", () => {
    const r = medir({ movimientos: [COMPRA, mov("2019-11-14", 113n)], dividendos: [PAGO, pago("2019-11-15", 41.37)] });
    expect(entradas(r)).toEqual([["2019-11-13", "PAGO", 733.19 / 1237], ["2019-11-15", "PAGO", 41.37 / 1237]]);
    expect(r.avisos).toEqual([]);
  });
});

describe("cuando no se sabe qué acciones lo cobraron: el pago no entra, se avisa y el decreto entra con su bruto", () => {
  it("el pago llegó antes de la ex de su decreto (dentro de la tolerancia de la ventana): DIVIDENDO_DECRETO_EN_DUDA", () => {
    const r = medir({ dividendos: [pago("2019-11-11")], decretos: [decreto("d", "2019-11-12", "2019-11-13", 0.61)] });
    expect(entradas(r)).toEqual([["2019-11-13", "DECRETO", 0.61]]);
    expect(avisos(r)).toEqual([["DIVIDENDO_DECRETO_EN_DUDA", "2019-11-11"], ["DECRETO_BRUTO", "2019-11-13"]]);
  });

  it("un pago en la ventana de dos decretos no elige: DIVIDENDO_DECRETO_EN_DUDA y los dos con su bruto", () => {
    const decretos = [decreto("a", "2020-01-03", "2020-01-10", 0.61), decreto("b", "2020-01-10", "2020-01-17", 2.13)];
    const r = medir({ dividendos: [pago("2020-01-15")], decretos });
    expect(entradas(r)).toEqual([["2020-01-10", "DECRETO", 0.61], ["2020-01-17", "DECRETO", 2.13]]);
    expect(avisos(r)).toEqual([["DIVIDENDO_DECRETO_EN_DUDA", "2020-01-15"], ["DECRETO_BRUTO", "2020-01-10"], ["DECRETO_BRUTO", "2020-01-17"]]);
  });

  it("la disputa es por pago: un pago con un solo decreto posible entra aunque otro pago dispute ese decreto", () => {
    const decretos = [decreto("a", "2020-01-03", "2020-01-10", 0.61), decreto("b", "2020-01-10", "2020-01-17", 2.13)];
    const r = medir({ dividendos: [pago("2020-01-08"), pago("2020-01-15", 802.61)], decretos });
    expect(entradas(r)).toEqual([["2020-01-08", "PAGO", 733.19 / 1237], ["2020-01-17", "DECRETO", 2.13]]);
    expect(avisos(r)).toEqual([["DIVIDENDO_DECRETO_EN_DUDA", "2020-01-15"], ["DECRETO_BRUTO", "2020-01-17"]]);
  });

  describe("un pago que junta decretos con fechas ex distintas (el 3 y el 10 de julio, pago el 17)", () => {
    const decretos = [decreto("o", "2019-07-03", "2019-07-17", 3.47), decreto("x", "2019-07-10", "2019-07-17", 0.97)];
    const conPago = (movimientos: MovimientoTenencia[]) => medir({ movimientos, dividendos: [pago("2019-07-18")], decretos });

    it("con la tenencia quieta entre las ex: entra con la tenencia antes de la primera ex", () => {
      expect(entradas(conPago([COMPRA]))).toEqual([["2019-07-18", "PAGO", 733.19 / 1237]]);
      // Una compra y una venta que se anulan el mismo día no la cambian.
      expect(entradas(conPago([COMPRA, mov("2019-07-05", 113n), mov("2019-07-05", -113n)]))).toEqual([["2019-07-18", "PAGO", 733.19 / 1237]]);
      // La compra del día de la segunda ex no cobra ninguno de los dos.
      expect(entradas(conPago([COMPRA, mov("2019-07-10", 113n)]))).toEqual([["2019-07-18", "PAGO", 733.19 / 1237]]);
    });

    it("la tenencia cambia entre las ex: DIVIDENDO_EX_DISTINTAS y los dos decretos con su bruto", () => {
      const r = conPago([COMPRA, mov("2019-07-05", 113n)]);
      expect(entradas(r)).toEqual([["2019-07-17", "DECRETO", 3.47], ["2019-07-17", "DECRETO", 0.97]]);
      expect(avisos(r)).toEqual([["DIVIDENDO_EX_DISTINTAS", "2019-07-18"], ["DECRETO_BRUTO", "2019-07-17"], ["DECRETO_BRUTO", "2019-07-17"]]);
      // También la compra del día de la primera ex: cambia la tenencia que cobra la segunda.
      expect(avisos(conPago([COMPRA, mov("2019-07-03", 113n)]))[0]).toEqual(["DIVIDENDO_EX_DISTINTAS", "2019-07-18"]);
    });

    it("si además no había tenencia antes de la primera ex, gana DIVIDENDO_EX_DISTINTAS", () => {
      expect(avisos(conPago([mov("2019-07-05", 1237n)]))[0]).toEqual(["DIVIDENDO_EX_DISTINTAS", "2019-07-18"]);
    });
  });

  it("sin tenencia antes de la ex, aunque la haya el día del pago: DIVIDENDO_SIN_TENENCIA (antes, DIVIDENDO_TENENCIA_CAMBIA)", () => {
    const compraDespuesDeLaEx = [mov("2019-11-07", 1237n)];
    expect(avisos(medir({ movimientos: compraDespuesDeLaEx, decretos: [] }))).toEqual([["DIVIDENDO_TENENCIA_CAMBIA", "2019-11-13"]]);
    const r = medir({ movimientos: compraDespuesDeLaEx });
    expect(entradas(r)).toEqual([["2019-11-13", "DECRETO", 0.61]]);
    expect(avisos(r)).toEqual([["DIVIDENDO_SIN_TENENCIA", "2019-11-13"], ["DECRETO_BRUTO", "2019-11-13"]]);
    // Vendió todo el día anterior a la ex, o la tenencia quedó negativa: tampoco hay quién lo cobró.
    expect(avisos(medir({ movimientos: [COMPRA, mov("2019-11-05", -1237n)] }))[0]).toEqual(["DIVIDENDO_SIN_TENENCIA", "2019-11-13"]);
    expect(avisos(medir({ movimientos: [COMPRA, mov("2019-11-01", -1311n)] }))[0]).toEqual(["DIVIDENDO_SIN_TENENCIA", "2019-11-13"]);
  });

  it("por pago, como el plan: si una fila del grupo no entra y otra sí, la que entró ya es el dividendo y el bruto no se suma", () => {
    const r = medir({ dividendos: [pago("2019-11-11", 41.37), pago("2019-11-14")], decretos: [decreto("d", "2019-11-12", "2019-11-13")] });
    expect(entradas(r)).toEqual([["2019-11-14", "PAGO", 733.19 / 1237]]);
    expect(avisos(r)).toEqual([["DIVIDENDO_DECRETO_EN_DUDA", "2019-11-11"]]);
  });

  it("un pago adelantado con la ex todavía por venir no entra, y su decreto se cuenta como futuro", () => {
    const r = medir({ dividendos: [pago("2020-06-29")], decretos: [decreto("d", "2020-07-01", "2020-07-02")] });
    expect(r.pagos).toEqual([]);
    expect(avisos(r)).toEqual([["DIVIDENDO_DECRETO_EN_DUDA", "2020-06-29"]]);
    expect(r.decretosFuturos).toBe(1);
  });
});

describe("propiedades (semilla)", () => {
  /** El código del motor que corresponde a cada motivo del plan (los demás motivos no se alcanzan en estas pruebas). */
  const CODIGO_DEL_MOTIVO: Partial<Record<MotivoSinDividendos, CodigoAviso>> = {
    TENENCIA_CAMBIA_CERCA_DEL_PAGO: "DIVIDENDO_TENENCIA_CAMBIA",
    DECRETO_EN_DUDA: "DIVIDENDO_DECRETO_EN_DUDA",
    EX_DISTINTAS_EN_EL_PAGO: "DIVIDENDO_EX_DISTINTAS",
  };
  const INICIO = dia("2019-01-08");
  const dentroDe = (azar: () => number, desde: number, dias: number) => sumar(INICIO, desde + Math.floor(azar() * dias));

  /** Compra inicial y movimientos que nunca dejan la tenencia en cero (el plan exige tenencia positiva en el tramo). */
  function movimientosPositivos(azar: () => number): MovimientoTenencia[] {
    const fechas = Array.from({ length: Math.floor(azar() * 11) }, () => dentroDe(azar, 1, 397)).sort((a, b) => a.getTime() - b.getTime());
    let tenencia = 1237n;
    const movimientos = [{ fecha: INICIO, cantidad: 1237n }];
    for (const fecha of fechas) {
      const cantidad = azar() < 0.5 ? BigInt(1 + Math.floor(azar() * 311)) : -BigInt(Math.floor(azar() * Number(tenencia - 1n)));
      tenencia += cantidad;
      movimientos.push({ fecha, cantidad });
    }
    return movimientos;
  }

  /** De 1 a 5 decretos (ex de 0 a 24 días antes del pago); a veces dos con el mismo pago y otra ex. */
  function decretosAlAzar(azar: () => number): DecretoLeido[] {
    const decretos: DecretoLeido[] = [];
    for (let i = 0, n = 1 + Math.floor(azar() * 5); i < n; i += 1) {
      const fechaPago = dentroDe(azar, 61, 337);
      const conEx = (j: number) => ({ id: `d${i}${j}`, fechaEx: sumar(fechaPago, -Math.floor(azar() * 25)), fechaPago, valorPorAccion: 1 + azar(), recibido: false });
      decretos.push(conEx(0), ...(azar() < 0.3 ? [conEx(1)] : []));
    }
    return decretos;
  }

  /** Pagos de Trii en días distintos (así cada aviso y cada entrada se ubican por su día) y en orden, como los lee el
   * lector; la mayoría cerca de la fecha de pago de algún decreto, para que caigan en su ventana. */
  function pagosAlAzar(azar: () => number, decretos: readonly DecretoLeido[] = []): { fechaPago: Date; monto: string }[] {
    const cercaDeUnDecreto = (): Date => sumar(decretos[Math.floor(azar() * decretos.length)]!.fechaPago, Math.floor(azar() * 16) - 4);
    const unDia = () => iso(decretos.length > 0 && azar() < 0.7 ? cercaDeUnDecreto() : dentroDe(azar, 61, 359));
    const dias = [...new Set(Array.from({ length: Math.floor(azar() * 7) }, unDia))].sort();
    return dias.map((d) => ({ fechaPago: dia(d), monto: (103.7 + azar() * 911.3).toFixed(2) }));
  }

  it("cada pago de Trii tiene el mismo veredicto y el mismo por acción que en el plan (un tramo desde antes de toda ex)", () => {
    const azar = azarDePrueba(4613);
    const ramas = new Map<string, number>();
    for (let caso = 0; caso < 997; caso += 1) {
      const movimientos = movimientosPositivos(azar);
      const decretos = decretosAlAzar(azar);
      const pagos = pagosAlAzar(azar, decretos);
      const r = dividendosPorAccion(accion("a", 1237, [], { movimientos, decretos, dividendos: pagos.map((p) => ({ fechaPago: p.fechaPago, montoNeto: Number(p.monto), decretadoId: null })) }), HOY);
      for (const p of pagos) {
        const plan = dividendosDelTramo(
          {
            dividendos: [{ id: "p", fechaPago: p.fechaPago, montoNeto: new Prisma.Decimal(p.monto), tipo: "ORDINARIO" }],
            movimientos, cubiertoHasta: HOY, destinoSinLote: false, escisiones: [], decretos: decretos.map(({ fechaEx, fechaPago }) => ({ fechaEx, fechaPago })),
          },
          INICIO, p.fechaPago, 1n,
        );
        const elDia = iso(p.fechaPago);
        const donde = `caso ${caso} · ${elDia}`;
        const entrada = r.pagos.find((x) => x.origen === "PAGO" && x.dia === elDia);
        const aviso = r.avisos.find((a) => a.codigo.startsWith("DIVIDENDO_") && a.dia === elDia);
        const rama = plan.medible ? (decretos.some((d) => enVentanaDePago(d.fechaPago, p.fechaPago)) ? "ENTRA_CON_DECRETO" : "ENTRA_SIN_DECRETO") : plan.motivo;
        ramas.set(rama, (ramas.get(rama) ?? 0) + 1);
        if (plan.medible) {
          expect(plan.atribuidos, donde).toHaveLength(1);
          expect(entrada?.porAccion, donde).toBe(Number(p.monto) / Number(plan.atribuidos[0]!.tenencia));
          expect(aviso, donde).toBeUndefined();
        } else {
          expect(entrada, donde).toBeUndefined();
          expect(aviso?.codigo, `${donde} · ${plan.motivo}`).toBe(CODIGO_DEL_MOTIVO[plan.motivo]);
        }
      }
    }
    // Que la propiedad pase por todas las ramas, no solo por la más común.
    for (const rama of ["ENTRA_CON_DECRETO", "ENTRA_SIN_DECRETO", "TENENCIA_CAMBIA_CERCA_DEL_PAGO", "DECRETO_EN_DUDA", "EX_DISTINTAS_EN_EL_PAGO"]) {
      expect(ramas.get(rama) ?? 0, rama).toBeGreaterThanOrEqual(30);
    }
  });

  it("sin decretos, el resultado es el de siempre: la tenencia del día del pago, quieta en los VENTANA_EX_DIAS anteriores", () => {
    const azar = azarDePrueba(1237);
    for (let caso = 0; caso < 293; caso += 1) {
      // Aquí la tenencia sí puede quedar en cero o negativa (DIVIDENDO_SIN_TENENCIA).
      const movimientos = [COMPRA, ...Array.from({ length: Math.floor(azar() * 5) }, () => ({ fecha: dentroDe(azar, -31, 431), cantidad: BigInt(Math.floor(azar() * 2611) - 1307) }))];
      const pagos = pagosAlAzar(azar).map((p) => ({ fechaPago: p.fechaPago, montoNeto: Number(p.monto), decretadoId: null }));
      const r = dividendosPorAccion(accion("a", 1237, [], { movimientos, dividendos: pagos }), HOY);
      // La conducta de antes de este cambio, escrita aparte: sin tenencia ese día, o con la tenencia moviéndose en los
      // VENTANA_EX_DIAS previos, no entra y se avisa; si no, por acción = neto / tenencia del día del pago.
      const veredictos = pagos.map((p) => {
        const tenencia = tenenciaEn(movimientos, p.fechaPago);
        if (tenencia <= 0n) return { aviso: ["DIVIDENDO_SIN_TENENCIA", iso(p.fechaPago)] };
        if (!constanteEn(movimientos, sumar(p.fechaPago, -VENTANA_EX_DIAS), p.fechaPago)) return { aviso: ["DIVIDENDO_TENENCIA_CAMBIA", iso(p.fechaPago)] };
        return { entrada: { dia: iso(p.fechaPago), porAccion: p.montoNeto / Number(tenencia), origen: "PAGO" } };
      });
      expect(r.pagos, `caso ${caso}`).toEqual(veredictos.flatMap((v) => (v.entrada ? [v.entrada] : [])));
      expect(avisos(r), `caso ${caso}`).toEqual(veredictos.flatMap((v) => (v.aviso ? [v.aviso] : [])));
      expect(r.decretosFuturos).toBe(0);
    }
  });

  it("los decretos cuya ventana no alcanza ningún pago no cambian las entradas de los pagos ni sus avisos", () => {
    const azar = azarDePrueba(311);
    for (let caso = 0; caso < 293; caso += 1) {
      const movimientos = movimientosPositivos(azar);
      const dividendos = pagosAlAzar(azar).map((p) => ({ fechaPago: p.fechaPago, montoNeto: Number(p.monto), decretadoId: null }));
      // Decretos al azar sin los que alcanzan algún pago.
      const lejanos = decretosAlAzar(azar).filter((d) => !dividendos.some((p) => enVentanaDePago(d.fechaPago, p.fechaPago)));
      const sin = dividendosPorAccion(accion("a", 1237, [], { movimientos, dividendos }), HOY);
      const con = dividendosPorAccion(accion("a", 1237, [], { movimientos, dividendos, decretos: lejanos }), HOY);
      const deLosPagos = (r: typeof sin) => ({ pagos: r.pagos.filter((p) => p.origen === "PAGO"), avisos: r.avisos.filter((a) => a.codigo !== "DECRETO_BRUTO") });
      expect(deLosPagos(con), `caso ${caso}`).toEqual(deLosPagos(sin));
      // Lo único que agregan son sus propias entradas DECRETO (y sus avisos) o su cuenta de futuros.
      const pasados = lejanos.filter((d) => d.fechaPago <= HOY);
      expect(con.pagos.filter((p) => p.origen === "DECRETO").length, `caso ${caso}`).toBe(pasados.length);
      expect(con.decretosFuturos, `caso ${caso}`).toBe(lejanos.length - pasados.length);
    }
  });
});
