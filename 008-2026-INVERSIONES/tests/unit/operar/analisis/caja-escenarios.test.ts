// Defecto de la prueba de Jelk: el «después» de los escenarios sumaba la compra y no restaba la caja que sale (valor de
// la orden más la comisión), así que comprar siempre «mejoraba» el p50. Aquí, la caja entra como parte fija (sin
// rendimiento) del antes y del después, y lo aportado no cambia con la operación. Propiedades con el simulador real y
// el motor de proyecciones tal cual. Datos inventados (FICTICIA-*, fechas anteriores a 2022).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { EntradasAnalisis } from "@/analisis/tipos";
import { portafolioDespues } from "@/operar/analisis/despues";
import { escenariosAntesDespues, type EntradaEscenario } from "@/operar/analisis/escenarios";
import { simularOperacion } from "@/operar/simulador/simular";
import type { ContextoSimulacion, LadoSimulado } from "@/operar/simulador/tipos";
import { crearPrng } from "@/proyecciones/prng";
import type { ParametrosProyeccion } from "@/proyecciones/tipos";
import { D, diasHabiles, portafolio, retornosRepetidos, serieDePrecios, serieDeRetornos, type EspecieFicticia } from "../../analisis/fixtures/portafolio.ficticio";
import { orden } from "../simulador/apoyo/estado.ficticio";

const DIAS = diasHabiles("2019-01-02", 300);
const volatil = (id: string, cantidad: number, inicial: number, escala: number): EspecieFicticia => ({ id, cantidad, cierres: serieDeRetornos(DIAS, inicial, retornosRepetidos(DIAS.length - 1, escala)) });
/** El mismo precio todos los días: comprarla no cambia la volatilidad del resto. */
const plana = (id: string, cantidad: number, precio: number): EspecieFicticia => ({ id, cantidad, cierres: serieDePrecios(DIAS, DIAS.map(() => precio)) });
const PRECIO_PLANO = "905.61";
const MIXTO = portafolio([volatil("FICTICIA-A", 37, 1237.4, 1), volatil("FICTICIA-B", 11, 4613.27, 2.3), plana("FICTICIA-C", 23, 905.61)]);
const QUIETO = portafolio([plana("FICTICIA-C", 23, 905.61), plana("FICTICIA-E", 41, 317.43)]);
const P: ParametrosProyeccion = { horizonteMeses: 12, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 211, semilla: 46_133 };
const HOY = MIXTO.hoy;
const SIN_COMISION: ContextoSimulacion = { ordenes: [], hoy: HOY };
/** Historia de órdenes inventada: la comisión se estima en 137,91 / 46.137,31 del valor de la orden. */
const CON_COMISION: ContextoSimulacion = { ordenes: [orden("COMPRA", "46137.31", "137.91"), orden("VENTA", "46137.31", "137.91")], hoy: HOY };

interface Estado {
  readonly entradas: EntradasAnalisis;
  readonly caja: Prisma.Decimal;
}

function operar(e: Estado, lado: LadoSimulado, id: string, cantidad: bigint, precio: string, contexto: ContextoSimulacion): Estado & { readonly comision: number } {
  const posiciones = [...e.entradas.tablero.filas, ...e.entradas.tablero.cerradas].map((f) => ({ instrumentoId: f.instrumentoId, nemotecnico: f.nemotecnico, cantidad: f.cantidad, cierre: f.cierre === null ? null : { precio: f.cierre.precio.toDecimalPlaces(6) } }));
  const r = simularOperacion({ posiciones, caja: e.caja, reglas: [] }, { instrumentoId: id, lado, cantidad, precioLimite: D(precio) }, contexto);
  if (!r.ok) throw new Error(`la operación inventada no pasó: ${r.errores.map((x) => x.codigo).join()}`);
  const s = r.simulacion;
  const despues = s.especies.find((x) => x.instrumentoId === id)!.despues.cantidad;
  return { entradas: { ...e.entradas, ...portafolioDespues(e.entradas, id, despues) }, caja: s.cajaDespues, comision: s.comision.estado === "SIN_HISTORIA" ? 0 : s.comision.valor.toNumber() };
}
const entrada = (e: Estado): EntradaEscenario => ({ historia: e.entradas.historia, caja: e.caja.toNumber(), accionesSinHistoria: 0 });
const comparar = (antes: Estado, despues: Estado) => escenariosAntesDespues(entrada(antes), entrada(despues), P)!;

describe("escenarios del antes y el después con la caja como parte fija", () => {
  const antes: Estado = { entradas: MIXTO, caja: D("93713.41") };

  it("el valor de partida trae acciones, fondo (si entra) y caja; comprar al cierre solo le quita la comisión", () => {
    const despues = operar(antes, "COMPRAR", "FICTICIA-C", 31n, PRECIO_PLANO, CON_COMISION);
    const e = comparar(antes, despues);
    expect(despues.comision).toBeGreaterThan(0);
    expect(e.antes.partida.caja).toBeCloseTo(93713.41, 6);
    expect(e.antes.partida.fondo).toBeNull();
    expect(e.antes.partida.total).toBeCloseTo(e.antes.partida.acciones + 93713.41, 6);
    expect(e.despues.partida.acciones - e.antes.partida.acciones).toBeCloseTo(31 * 905.61, 6);
    expect(e.antes.partida.caja - e.despues.partida.caja).toBeCloseTo(31 * 905.61 + despues.comision, 6);
    expect(e.antes.partida.total - e.despues.partida.total).toBeCloseTo(despues.comision, 6);
  });

  it("propiedad: comprar y vender lo mismo al mismo precio, sin comisión, deja los escenarios iguales al antes", () => {
    const azar = crearPrng(46_133);
    const ids = ["FICTICIA-A", "FICTICIA-B", "FICTICIA-C"];
    for (let k = 0; k < 7; k += 1) {
      const id = ids[azar.enteroMenorQue(ids.length)]!;
      const cantidad = BigInt(1 + azar.enteroMenorQue(53));
      const precio = `${311 + azar.enteroMenorQue(4_613)}.${10 + azar.enteroMenorQue(89)}`;
      const ida = operar(antes, "COMPRAR", id, cantidad, precio, SIN_COMISION);
      const vuelta = operar(ida, "VENDER", id, cantidad, precio, SIN_COMISION);
      const e = comparar(antes, vuelta);
      expect(e.despues.partida.total, `corrida ${k}`).toBeCloseTo(e.antes.partida.total, 6);
      e.antes.puntos.forEach((p, i) => {
        const d = e.despues.puntos[i]!;
        for (const q of ["p5", "p50", "p95"] as const) expect(Math.abs(d[q] - p[q]) / p[q], `corrida ${k}, mes ${p.mes}, ${q}`).toBeLessThan(1e-9);
      });
      expect(e.despues.probabilidadBajoAportado, `corrida ${k}`).toBe(e.antes.probabilidadBajoAportado);
      // Y la ida sí mueve los escenarios (la prueba no pasa en vacío).
      expect(comparar(antes, ida).despues.puntos.at(-1)!.p50, `corrida ${k}`).not.toBeCloseTo(e.antes.puntos.at(-1)!.p50, 2);
    }
  });

  it("propiedad: comprar con comisión, al mismo precio y con la misma volatilidad, nunca da un p50 mayor que el antes", () => {
    const azar = crearPrng(37_911);
    for (let k = 0; k < 7; k += 1) {
      const despues = operar(antes, "COMPRAR", "FICTICIA-C", BigInt(1 + azar.enteroMenorQue(71)), PRECIO_PLANO, CON_COMISION);
      const e = comparar(antes, despues);
      e.antes.puntos.forEach((p, i) => {
        const d = e.despues.puntos[i]!;
        expect(d.p50, `corrida ${k}, mes ${p.mes}`).toBeLessThan(p.p50);
        // La compra no rinde ni pierde (precio fijo): cada percentil baja justo la comisión.
        for (const q of ["p5", "p50", "p95"] as const) expect(p[q] - d[q], `corrida ${k}, mes ${p.mes}, ${q}`).toBeCloseTo(despues.comision, 4);
      });
      expect(e.despues.probabilidadBajoAportado, `corrida ${k}`).toBeGreaterThanOrEqual(e.antes.probabilidadBajoAportado);
    }
  });

  it("en una venta pasa lo inverso: la caja sube el valor de la orden menos la comisión", () => {
    const despues = operar(antes, "VENDER", "FICTICIA-C", 17n, PRECIO_PLANO, CON_COMISION);
    const e = comparar(antes, despues);
    expect(e.despues.partida.caja - e.antes.partida.caja).toBeCloseTo(17 * 905.61 - despues.comision, 6);
    e.antes.puntos.forEach((p, i) => expect(p.p50 - e.despues.puntos[i]!.p50).toBeCloseTo(despues.comision, 4));
  });

  it("lo aportado no cambia con la operación: la comisión deja el portafolio por debajo de lo aportado", () => {
    const quieto: Estado = { entradas: QUIETO, caja: D("4613.27") };
    const sin = comparar(quieto, operar(quieto, "COMPRAR", "FICTICIA-E", 7n, "317.43", SIN_COMISION));
    expect(sin.antes.probabilidadBajoAportado).toBe(0);
    expect(sin.despues.probabilidadBajoAportado).toBe(0);
    const con = comparar(quieto, operar(quieto, "COMPRAR", "FICTICIA-E", 7n, "317.43", CON_COMISION));
    expect(con.antes.probabilidadBajoAportado).toBe(0);
    expect(con.despues.probabilidadBajoAportado).toBe(1);
  });

  it("con aportes, caída inicial y dividendos sin reinvertir, la ida y vuelta sigue igual al antes y la comisión baja cada percentil", () => {
    const otros: ParametrosProyeccion = { ...P, aportePeriodico: 371.13, frecuenciaAporte: "TRIMESTRAL", caidaInicialPct: 5, reinvertirDividendos: false };
    const ida = operar(antes, "COMPRAR", "FICTICIA-B", 13n, "4613.27", SIN_COMISION);
    const vuelta = operar(ida, "VENDER", "FICTICIA-B", 13n, "4613.27", SIN_COMISION);
    const igual = escenariosAntesDespues(entrada(antes), entrada(vuelta), otros)!;
    igual.antes.puntos.forEach((p, i) => expect(Math.abs(igual.despues.puntos[i]!.p50 - p.p50) / p.p50).toBeLessThan(1e-9));
    const compra = operar(antes, "COMPRAR", "FICTICIA-C", 31n, PRECIO_PLANO, CON_COMISION);
    const e = escenariosAntesDespues(entrada(antes), entrada(compra), otros)!;
    // La caída inicial (5 %) también le pega a la caja, como a todo el portafolio del motor; la comisión sale antes. Los
    // aportes se reparten con los pesos de cada lado, que cambian un poco: por eso la tolerancia es de centavos.
    e.antes.puntos.forEach((p, i) => expect(p.p50 - e.despues.puntos[i]!.p50).toBeCloseTo(compra.comision * 0.95, 0));
  });

  it("sin valor de partida positivo (la compra deja el total en cero o menos), no hay escenarios: no se inventan cifras", () => {
    const quieto: Estado = { entradas: QUIETO, caja: D("13.71") };
    const base = entrada(quieto);
    expect(escenariosAntesDespues(base, { ...base, caja: -(23 * 905.61 + 41 * 317.43) - 37.11 }, P)).toBeNull();
    expect(escenariosAntesDespues({ ...base, caja: -(23 * 905.61 + 41 * 317.43) }, base, P)).toBeNull();
    expect(escenariosAntesDespues(base, base, P)).not.toBeNull();
  });
});
