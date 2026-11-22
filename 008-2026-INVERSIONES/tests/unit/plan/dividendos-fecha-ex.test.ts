// Dividendos de un tramo con la fecha ex del decreto (fase C, C5c: src/plan/dividendos.ts). Puro. Datos inventados.
// Con un decreto vigente cuya ventana de pago (src/datos-oficiales/decretos/ventana.ts, la del cruce) contiene el pago de
// Trii, manda su fecha ex: cobra la tenencia del cierre del día anterior a la ex y el tramo que empieza en la ex o
// después no lo cobra. Sin decreto, la aproximación de siempre (VENTANA_EX_DIAS).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { MOTIVOS_SIN_DIVIDENDOS } from "@/app/_plan/textos";
import { VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS } from "@/datos-oficiales/decretos/ventana";
import { VENTANA_EX_DIAS, dividendosDelTramo, type ContextoEspecie, type DividendoPagado } from "@/plan/dividendos";
import { sumarDias } from "@/plan/fechas";
import { calcularResultado, type Cierre } from "@/plan/resultado";
import { tenenciaAntesDeLaEx, type MovimientoTenencia } from "@/plan/tenencia";
import { azarDePrueba } from "../proyecciones/ficticio";

const D = (v: string) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const div = (id: string, iso: string, monto: string, tipo: DividendoPagado["tipo"] = "ORDINARIO"): DividendoPagado => ({ id, fechaPago: dia(iso), montoNeto: D(monto), tipo });
const mov = (iso: string, cantidad: bigint): MovimientoTenencia => ({ fecha: dia(iso), cantidad });
const decreto = (ex: string, pago: string) => ({ fechaEx: dia(ex), fechaPago: dia(pago) });

const BASE = dia("2027-03-01");
const OBJETIVO = dia("2027-03-31");
const COMPRA = mov("2027-01-11", 1237n);
/** El decreto de siempre: ex el 16 y pago el 23. */
const DECRETO = decreto("2027-03-16", "2027-03-23");
const PAGO = div("p", "2027-03-23", "4613.27");

const contexto = (cambios: Partial<ContextoEspecie> = {}): ContextoEspecie => ({
  dividendos: [PAGO],
  movimientos: [COMPRA],
  cubiertoHasta: dia("2027-12-31"),
  destinoSinLote: false,
  escisiones: [],
  ...cambios,
});
const tramo = (ctx: ContextoEspecie, cantidad = 97n, base = BASE, objetivo = OBJETIVO) => dividendosDelTramo(ctx, base, objetivo, cantidad);
/** [tenencia, por acción, atribuido] de cada pago atribuido; null si el tramo no es medible. */
const usados = (ctx: ContextoEspecie, cantidad = 97n, base = BASE, objetivo = OBJETIVO) => {
  const r = tramo(ctx, cantidad, base, objetivo);
  return r.medible ? r.atribuidos.map((a) => [a.tenencia, a.porAccion.toString(), a.atribuido.toString()]) : null;
};

describe("la tenencia que cobra un dividendo: la del cierre del día anterior a la ex", () => {
  it("la compra del día anterior a la ex cuenta; la del mismo día de la ex, no", () => {
    const ex = dia("2027-03-16");
    expect(tenenciaAntesDeLaEx([COMPRA, mov("2027-03-15", 311n)], ex)).toBe(1548n);
    expect(tenenciaAntesDeLaEx([COMPRA, mov("2027-03-16", 311n)], ex)).toBe(1237n);
    expect(tenenciaAntesDeLaEx([COMPRA, mov("2027-03-15", -311n)], ex)).toBe(926n);
  });
});

describe("con decreto, manda su fecha ex", () => {
  it("una venta entre la ex y el pago ya no impide medir: el divisor es la tenencia antes de la ex", () => {
    const vendioDespues = contexto({ movimientos: [COMPRA, mov("2027-03-18", -311n)] });
    expect(tramo(vendioDespues)).toEqual({ medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" });
    // 4.613,27 netos sobre las 1.237 que había antes de la ex: 3,729402 por acción; 97 acciones → 361,752.
    expect(usados({ ...vendioDespues, decretos: [DECRETO] })).toEqual([[1237n, "3.729402", "361.752"]]);
  });

  it("la compra del día anterior a la ex cobra (entra al divisor); la del día de la ex, no", () => {
    expect(usados(contexto({ movimientos: [COMPRA, mov("2027-03-15", 311n)], decretos: [DECRETO] }))).toEqual([[1548n, "2.980149", "289.0744"]]);
    expect(usados(contexto({ movimientos: [COMPRA, mov("2027-03-16", 311n)], decretos: [DECRETO] }))).toEqual([[1237n, "3.729402", "361.752"]]);
  });

  it("un tramo que empieza en la ex o después no cobra ese pago: medible, sin atribuirlo", () => {
    const compraEnLaEx = contexto({ movimientos: [COMPRA, mov("2027-03-16", 97n)], decretos: [DECRETO] });
    expect(tramo(compraEnLaEx, 97n, dia("2027-03-16"))).toMatchObject({ medible: true, atribuidos: [] });
    expect(tramo({ ...compraEnLaEx, decretos: [] }, 97n, dia("2027-03-16"))).toEqual({ medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" });
  });

  it("una compra después de la ex y más de 10 días antes del pago: sin decreto se le atribuía; con él, no", () => {
    const exTemprana = decreto("2027-03-02", "2027-03-23");
    const ctx = contexto({ movimientos: [COMPRA, mov("2027-03-05", 97n)] });
    expect(tramo(ctx, 97n, dia("2027-03-05"))).toMatchObject({ medible: true, atribuidos: [{ dividendoId: "p" }] });
    const r = tramo({ ...ctx, decretos: [exTemprana] }, 97n, dia("2027-03-05"));
    expect(r).toMatchObject({ medible: true, atribuidos: [] });
    expect(r.medible && r.total.isZero()).toBe(true);
  });

  it("«no actuar» decidido el día de la ex no lo cobra; decidido el día anterior, sí", () => {
    const ctx = contexto({ decretos: [DECRETO] });
    expect(tramo(ctx, 97n, dia("2027-03-16"))).toMatchObject({ medible: true, atribuidos: [] });
    expect(usados(ctx, 97n, dia("2027-03-15"))).toEqual([[1237n, "3.729402", "361.752"]]);
  });

  it("vender el día anterior a la ex: dejó de cobrarlo (el divisor ya descuenta la venta); el día de la ex: lo cobró", () => {
    const antes = contexto({ movimientos: [COMPRA, mov("2027-03-15", -311n)], decretos: [DECRETO] });
    expect(usados(antes, 311n, dia("2027-03-15"))).toEqual([[926n, "4.981933", "1549.3812"]]);
    const enLaEx = contexto({ movimientos: [COMPRA, mov("2027-03-16", -311n)], decretos: [DECRETO] });
    expect(tramo(enLaEx, 311n, dia("2027-03-16"))).toMatchObject({ medible: true, atribuidos: [] });
  });

  it("en el resultado de vender, el dividendo que dejó de cobrar resta", () => {
    const venta = { id: "o-v", fechaOperacion: dia("2027-03-15"), cantidadCompletada: 311n, totalEstimado: D("4271.13") };
    const cierre: Cierre = { id: "c", fecha: sumarDias(venta.fechaOperacion, 30), precio: D("13.71"), estado: "NO_VERIFICADO", fuente: "yahoo" };
    const especie = contexto({ movimientos: [COMPRA, mov("2027-03-15", -311n)], decretos: [DECRETO] });
    const r = calcularResultado({ accion: "VENDER", fechaDecision: venta.fechaOperacion, cantidad: null, ordenes: [venta], cierres: [cierre], especie, hoy: dia("2027-06-01") }, 30);
    expect([r.incluyeDividendos, r.dividendosPesos?.toString()]).toEqual([true, "-1549.3812"]);
  });

  it("dos filas de Trii del mismo decreto usan el mismo divisor", () => {
    const ctx = contexto({ dividendos: [PAGO, div("p2", "2027-03-24", "371.93")], movimientos: [COMPRA, mov("2027-03-18", -311n)], decretos: [DECRETO] });
    const r = tramo(ctx);
    expect(r.medible && r.atribuidos.map((a) => a.tenencia)).toEqual([1237n, 1237n]);
    expect(r.medible && r.total.toString()).toBe("390.9171");
  });

  it("la fracción de una escisión en la ventana del decreto no se asigna, no se atribuye ni crea duda", () => {
    const ctx = contexto({ dividendos: [div("f", "2027-03-20", "41.37", "FRACCION_ESCISION"), PAGO], movimientos: [COMPRA, mov("2027-03-18", -311n)], decretos: [DECRETO] });
    expect(usados(ctx)).toEqual([[1237n, "3.729402", "361.752"]]);
  });
});

describe("cuando los decretos no dan una sola fecha ex", () => {
  it("dos decretos se disputan el pago (cabe en las dos ventanas): DECRETO_EN_DUDA", () => {
    const ctx = contexto({ decretos: [decreto("2027-03-13", "2027-03-20"), DECRETO] });
    expect(tramo(ctx)).toEqual({ medible: false, motivo: "DECRETO_EN_DUDA" });
  });

  it("un pago con un solo decreto posible se mide aunque otro pago dispute su decreto (a 30 y a 90 días igual)", () => {
    // p1 (día 8) solo cabe en la ventana del decreto del 10; p2 (día 18) cabe en la del 10 y en la del 20.
    const ctx = contexto({
      dividendos: [div("p1", "2027-03-08", "4613.27"), div("p2", "2027-03-18", "371.93")],
      movimientos: [COMPRA, mov("2027-03-05", -311n)],
      decretos: [decreto("2027-03-03", "2027-03-10"), decreto("2027-03-16", "2027-03-20")],
    });
    expect(usados(ctx, 97n, BASE, dia("2027-03-12"))).toEqual([[1237n, "3.729402", "361.752"]]);
    expect(tramo(ctx)).toEqual({ medible: false, motivo: "DECRETO_EN_DUDA" });
  });

  it("el pago llegó antes de la ex de su decreto (dentro de la tolerancia de la ventana): DECRETO_EN_DUDA", () => {
    const ctx = contexto({ dividendos: [div("p", "2027-03-21", "4613.27")], decretos: [decreto("2027-03-22", "2027-03-23")] });
    expect(tramo(ctx)).toEqual({ medible: false, motivo: "DECRETO_EN_DUDA" });
    // También si solo uno de los decretos del pago tiene la ex después del pago.
    const mezcla = contexto({ dividendos: [div("p", "2027-03-21", "4613.27")], decretos: [decreto("2027-03-16", "2027-03-23"), decreto("2027-03-22", "2027-03-23")] });
    expect(tramo(mezcla)).toEqual({ medible: false, motivo: "DECRETO_EN_DUDA" });
  });

  describe("un pago que junta decretos con fechas ex distintas (el 9 y el 16, pago el 23)", () => {
    const EXS = [decreto("2027-03-09", "2027-03-23"), DECRETO];
    const despues = mov("2027-03-18", -311n);

    it("con la tenencia quieta entre las ex y el tramo antes de la primera: medible, con la tenencia antes de la primera ex", () => {
      expect(usados(contexto({ movimientos: [COMPRA, despues], decretos: EXS }))).toEqual([[1237n, "3.729402", "361.752"]]);
      // Una compra y una venta que se anulan el mismo día entre las ex no cambian la tenencia.
      const anuladas = contexto({ movimientos: [COMPRA, mov("2027-03-12", 41n), mov("2027-03-12", -41n), despues], decretos: EXS });
      expect(usados(anuladas)).toEqual([[1237n, "3.729402", "361.752"]]);
    });

    it("la tenencia cambia entre las ex: EX_DISTINTAS_EN_EL_PAGO", () => {
      expect(tramo(contexto({ movimientos: [COMPRA, mov("2027-03-12", 97n)], decretos: EXS }))).toEqual({ medible: false, motivo: "EX_DISTINTAS_EN_EL_PAGO" });
    });

    it("«no actuar» decidido entre las ex, sin movimientos: EX_DISTINTAS_EN_EL_PAGO", () => {
      expect(tramo(contexto({ decretos: EXS }), 97n, dia("2027-03-12"))).toEqual({ medible: false, motivo: "EX_DISTINTAS_EN_EL_PAGO" });
    });

    it("el tramo empieza en la última ex o después: no lo cobra", () => {
      expect(tramo(contexto({ decretos: EXS }), 97n, dia("2027-03-16"))).toMatchObject({ medible: true, atribuidos: [] });
    });
  });

  it("los motivos generales van primero; entre los pagos, manda el primero por fecha", () => {
    const enDuda = [decreto("2027-03-13", "2027-03-20"), DECRETO];
    expect(tramo(contexto({ decretos: enDuda, cubiertoHasta: dia("2027-03-30") }))).toEqual({ medible: false, motivo: "CARGA_NO_CUBRE" });
    // p1 (día 10) sin decreto y con una venta 5 días antes; p2 (día 23) en duda.
    const respaldoPrimero = contexto({ dividendos: [div("p1", "2027-03-10", "371.93"), PAGO], movimientos: [COMPRA, mov("2027-03-05", -311n)], decretos: enDuda });
    expect(tramo(respaldoPrimero)).toEqual({ medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" });
    // p1 (día 23) en duda; p2 (8 de abril, fuera de toda ventana) sin decreto y con una venta 2 días antes.
    const dudaPrimero = contexto({ dividendos: [PAGO, div("p2", "2027-04-08", "371.93")], movimientos: [COMPRA, mov("2027-04-06", -311n)], decretos: enDuda });
    expect(tramo(dudaPrimero, 97n, BASE, dia("2027-04-10"))).toEqual({ medible: false, motivo: "DECRETO_EN_DUDA" });
  });
});

describe("sin decreto que alcance el pago, la aproximación de siempre (VENTANA_EX_DIAS)", () => {
  it(`un decreto cuya ventana no contiene el pago no cambia nada: una venta en los ${VENTANA_EX_DIAS} días anteriores sigue bloqueando`, () => {
    const lejano = decreto("2027-02-26", "2027-03-05");
    const ctx = contexto({ movimientos: [COMPRA, mov("2027-03-18", -311n)], decretos: [lejano] });
    expect(tramo(ctx)).toEqual({ medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" });
    expect(usados(contexto({ decretos: [lejano] }))).toEqual([[1237n, "3.729402", "361.752"]]);
  });
});

// ───────────── Propiedades con semilla ─────────────

const DIAS = 60;
const INICIO = dia("2027-02-01");
const diaAzar = (azar: () => number, desde = 0, rango = DIAS) => sumarDias(INICIO, desde + Math.floor(azar() * rango));

function contextoAzar(azar: () => number): { ctx: ContextoEspecie; base: Date; objetivo: Date } {
  const movimientos = [mov("2027-01-11", BigInt(100 + Math.floor(azar() * 3917)))];
  for (let i = Math.floor(azar() * 4); i > 0; i -= 1) movimientos.push({ fecha: diaAzar(azar), cantidad: BigInt(Math.floor(azar() * 61) - 30) });
  const dividendos = Array.from({ length: Math.floor(azar() * 4) }, (_, i) =>
    div(`p${i}`, diaAzar(azar).toISOString().slice(0, 10), (1 + azar() * 9000).toFixed(2), azar() < 0.1 ? "FRACCION_ESCISION" : "ORDINARIO"));
  const decretos = Array.from({ length: Math.floor(azar() * 4) }, () => {
    const pago = diaAzar(azar);
    return { fechaEx: sumarDias(pago, -Math.floor(azar() * 25)), fechaPago: pago };
  });
  const base = diaAzar(azar, -5, 30);
  return { ctx: contexto({ dividendos, movimientos, decretos }), base, objetivo: sumarDias(base, 30 + Math.floor(azar() * 30)) };
}

describe("propiedades (semilla)", () => {
  it("sin decretos, con la lista vacía o sin el campo, el resultado es el mismo", () => {
    const azar = azarDePrueba(4613);
    for (let caso = 0; caso < 300; caso += 1) {
      const { ctx, base, objetivo } = contextoAzar(azar);
      const { decretos: _d, ...sinCampo } = ctx;
      expect(dividendosDelTramo({ ...ctx, decretos: [] }, base, objetivo, 97n), `caso ${caso}`).toEqual(dividendosDelTramo(sinCampo, base, objetivo, 97n));
    }
  });

  it("agregar decretos cuya ventana no alcanza ningún pago no cambia nada", () => {
    const azar = azarDePrueba(37911);
    for (let caso = 0; caso < 300; caso += 1) {
      const { ctx, base, objetivo } = contextoAzar(azar);
      const pagos = ctx.dividendos.map((d) => d.fechaPago.getTime());
      const lejos = [sumarDias(INICIO, -VENTANA_PAGO_ANTES_DIAS - 30), sumarDias(INICIO, DIAS + VENTANA_PAGO_DESPUES_DIAS + 30)]
        .filter((p) => pagos.every((t) => t < sumarDias(p, -VENTANA_PAGO_ANTES_DIAS).getTime() || t > sumarDias(p, VENTANA_PAGO_DESPUES_DIAS).getTime()))
        .map((p) => ({ fechaEx: sumarDias(p, -7), fechaPago: p }));
      const conLejanos = { ...ctx, decretos: [...(ctx.decretos ?? []), ...lejos] };
      expect(dividendosDelTramo(conLejanos, base, objetivo, 97n), `caso ${caso}`).toEqual(dividendosDelTramo(ctx, base, objetivo, 97n));
    }
  });

  it("lo medible siempre divide entre una tenencia positiva y atribuye solo pagos de (base, objetivo]", () => {
    const azar = azarDePrueba(1237);
    let medibles = 0;
    for (let caso = 0; caso < 500; caso += 1) {
      const { ctx, base, objetivo } = contextoAzar(azar);
      const r = dividendosDelTramo(ctx, base, objetivo, 97n);
      if (!r.medible) continue;
      medibles += 1;
      for (const a of r.atribuidos) {
        expect(a.tenencia > 0n, `caso ${caso}`).toBe(true);
        expect(a.atribuido.isFinite() && a.porAccion.isFinite(), `caso ${caso}`).toBe(true);
        expect(a.fechaPago > base && a.fechaPago <= objetivo, `caso ${caso}`).toBe(true);
      }
    }
    expect(medibles).toBeGreaterThan(50);
  });
});

describe("los textos de los motivos nuevos", () => {
  it("cada motivo tiene su texto, y el de la aproximación dice que es para un pago sin decreto", () => {
    expect(MOTIVOS_SIN_DIVIDENDOS.DECRETO_EN_DUDA).toMatch(/fecha ex/);
    expect(MOTIVOS_SIN_DIVIDENDOS.EX_DISTINTAS_EN_EL_PAGO).toMatch(/fechas ex distintas/);
    expect(MOTIVOS_SIN_DIVIDENDOS.TENENCIA_CAMBIA_CERCA_DEL_PAGO).toMatch(/sin decreto registrado/);
    expect(MOTIVOS_SIN_DIVIDENDOS.TENENCIA_CAMBIA_CERCA_DEL_PAGO).not.toMatch(/que la base no tiene/);
  });
});
