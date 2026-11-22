// El análisis de punta a punta con portafolios inventados: versión, orden, pesos del tablero, riesgo en la ventana común
// (correlación +1 y −1, una sola especie, pesos iguales), especies sin historia o sin valor, el fondo fuera, el efecto
// de la caída máxima, la referencia, los avisos, el JSON y el determinismo. Puro.
import { describe, expect, it } from "vitest";
import { analizar } from "@/analisis/analizar";
import { resumirDecisiones } from "@/analisis/decisiones";
import { redondear } from "@/analisis/numeros";
import { toleranciaSuma } from "@/analisis/riesgo";
import { VERSION_ANALISIS, type Analisis, type AnalisisEspecie, type EntradasAnalisis } from "@/analisis/tipos";
import { armarHistoria } from "@/proyecciones/historia";
import { Prisma } from "@prisma/client";
import {
  cerrada, D, decision, dia, diasHabiles, horizonte, iso, portafolio, retornosRepetidos, serieDePrecios, serieDeRetornos, sumar, type EspecieFicticia,
} from "./fixtures/portafolio.ficticio";

const DIAS = diasHabiles("2019-01-02", 300);
const especie = (id: string, cantidad: number, inicial: number, escala: number, dias = DIAS): EspecieFicticia => ({
  id, cantidad, cierres: serieDeRetornos(dias, inicial, retornosRepetidos(dias.length - 1, escala)),
});
const de = (a: Analisis, id: string): AnalisisEspecie => {
  const e = a.especies.find((x) => x.instrumentoId === id);
  if (!e) throw new Error(`no está ${id}`);
  return e;
};
const cubierta = (e: AnalisisEspecie) => {
  if (e.riesgo.estado !== "CUBIERTA") throw new Error(`${e.instrumentoId} no está cubierta`);
  return e.riesgo;
};
const calculado = (a: Analisis) => {
  if (a.riesgo.estado !== "CALCULADO") throw new Error("el riesgo debía calcularse");
  return a.riesgo;
};
const cerca = (x: number, y: number, tol = 2e-8) => expect(Math.abs(x - y)).toBeLessThanOrEqual(tol);

describe("análisis · identidad y orden", () => {
  const e = portafolio([especie("FICTICIA-B", 11, 4613.27, 2), especie("FICTICIA-A", 37, 1237.4, 1), { id: "FICTICIA-N", cantidad: 13, cierres: [], cierreTablero: null, soloTablero: true }]);
  const a = analizar(e);

  it("la versión del cálculo y el día", () => {
    expect(a.version).toBe(VERSION_ANALISIS);
    expect(VERSION_ANALISIS).toBe("analisis-v1");
    expect(a.hoy).toBe(iso(e.hoy));
  });

  it("de mayor a menor valor, las sin valor al final; el peso y el valor salen del tablero", () => {
    expect(a.especies.map((x) => x.instrumentoId)).toEqual(["FICTICIA-B", "FICTICIA-A", "FICTICIA-N"]);
    expect(a.valorAcciones.eq(e.tablero.valorAcciones)).toBe(true);
    const fila = e.tablero.filas.find((f) => f.instrumentoId === "FICTICIA-A")!;
    expect(de(a, "FICTICIA-A").valor!.eq(fila.valor!)).toBe(true);
    expect(de(a, "FICTICIA-A").peso).toBe(redondear(fila.valor!.div(e.tablero.valorAcciones).toNumber()));
    expect(de(a, "FICTICIA-A").nemotecnico).toBe("FICTA");
  });

  it("en un empate de valor, por id", () => {
    const iguales = portafolio([
      { id: "FICTICIA-D", cantidad: 74, cierres: serieDePrecios(DIAS.slice(0, 3), [601.3, 611.9, 618.7]) },
      { id: "FICTICIA-C", cantidad: 37, cierres: serieDePrecios(DIAS.slice(0, 3), [1201.3, 1211.9, 1237.4]) },
    ]);
    expect(analizar(iguales).especies.map((x) => x.instrumentoId)).toEqual(["FICTICIA-C", "FICTICIA-D"]);
  });

  it("varias sin valor van al final, por id", () => {
    const sinValor = (id: string): EspecieFicticia => ({ id, cantidad: 13, cierres: [], cierreTablero: null, soloTablero: true });
    const a = analizar(portafolio([sinValor("FICTICIA-Y"), especie("FICTICIA-A", 37, 1237.4, 1), sinValor("FICTICIA-X")]));
    expect(a.especies.map((x) => x.instrumentoId)).toEqual(["FICTICIA-A", "FICTICIA-X", "FICTICIA-Y"]);
  });

  it("una especie que está en la historia sin cierres de Yahoo (el tablero sí tiene cierre): sin cierres propios", () => {
    const ultimo = DIAS.at(-1)!;
    const sinYahoo = { id: "FICTICIA-W", cantidad: 13, cierres: [], cierreTablero: { precio: D("905.61"), fecha: ultimo } };
    const w = de(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1), sinYahoo])), "FICTICIA-W");
    expect(w).toMatchObject({ historia: { estado: "SIN_CIERRES" }, riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 } });
    expect(w.valor!.eq(D("905.61").mul(13))).toBe(true);
  });

  it("una especie sin cierre en el tablero: sin valor, sin peso y sin riesgo", () => {
    const sin = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), { ...especie("FICTICIA-N", 13, 905.61, 1), cierreTablero: null }]);
    expect(de(analizar(sin), "FICTICIA-N")).toMatchObject({ valor: null, peso: null, cierre: { estado: "SIN_CIERRE" }, riesgo: { estado: "SIN_VALOR" }, efectoCaida: null, dividendo12m: null });
  });

  it("una especie que la historia no trae: sin cierres propios y sin historia en la ventana", () => {
    const n = de(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1), { ...especie("FICTICIA-S", 13, 905.61, 1), soloTablero: true }])), "FICTICIA-S");
    expect(n).toMatchObject({ historia: { estado: "SIN_CIERRES" }, riesgo: { estado: "SIN_HISTORIA", motivo: "SIN_CIERRES", dias: 0 }, dividendo12m: null, proximaEx: null, efectoCaida: null });
  });
});

describe("análisis · riesgo en la ventana común", () => {
  it("correlación +1 (B = 2 × A): ρ = 1, la volatilidad de B es el doble y las contribuciones suman σp", () => {
    const e = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2)]);
    const a = analizar(e);
    const r = calculado(a);
    expect(r.correlacion).toEqual({ ids: ["FICTICIA-A", "FICTICIA-B"], valores: [[1, 1], [1, 1]] });
    const [ra, rb] = [cubierta(de(a, "FICTICIA-A")), cubierta(de(a, "FICTICIA-B"))];
    cerca(rb.volatilidadAnual, 2 * ra.volatilidadAnual);
    cerca(ra.contribucion!.contribucion + rb.contribucion!.contribucion, r.volatilidadAnual, toleranciaSuma(2));
    cerca(ra.contribucion!.contribucionPct + rb.contribucion!.contribucionPct, 1, toleranciaSuma(2));
    expect(r.fraccionCubierta).toBe(1);
    expect(ra.pesoCubierto).toBe(de(a, "FICTICIA-A").peso);
  });

  it("el factor de anualización es 12 × ruedasPorMes de la ventana común de armarHistoria", () => {
    const e = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2)]);
    const r = calculado(analizar(e));
    expect(r.factorAnualizacion).toBe(redondear(12 * armarHistoria(e.historia).historia.ruedasPorMes));
    expect(r.ventana).toEqual(armarHistoria(e.historia).ventana);
  });

  it("correlación −1 (B = −A)", () => {
    const r = calculado(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, -1)])));
    expect(r.correlacion.valores[0]![1]).toBe(-1);
  });

  it("correlación −1 con pesos iguales (del tablero): σp = 0 y no hay contribuciones", () => {
    const ultimo = iso(DIAS.at(-1)!);
    const e = portafolio([
      { ...especie("FICTICIA-A", 37, 1237.4, 1), cierreTablero: { precio: D("1237.4"), fecha: dia(ultimo) } },
      { ...especie("FICTICIA-B", 74, 618.7, -1), cierreTablero: { precio: D("618.7"), fecha: dia(ultimo) } },
    ]);
    const a = analizar(e);
    expect(a.especies.map((x) => x.peso)).toEqual([0.5, 0.5]);
    expect(a.concentracion).toMatchObject({ hhi: 0.5, especiesEfectivas: 2 });
    expect(calculado(a).volatilidadAnual).toBe(0);
    expect(a.especies.map((x) => cubierta(x).contribucion)).toEqual([null, null]);
  });

  it("una sola especie: su contribución es toda la volatilidad y el HHI es 1", () => {
    const a = analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)]));
    const r = cubierta(de(a, "FICTICIA-A"));
    expect(r.contribucion!.contribucionPct).toBe(1);
    cerca(r.contribucion!.contribucion, calculado(a).volatilidadAnual);
    expect(r.volatilidadAnual).toBe(calculado(a).volatilidadAnual);
    expect(a.concentracion).toMatchObject({ especies: 1, hhi: 1, especiesEfectivas: 1 });
  });

  it("una especie con 100 días queda sin historia en la ventana y fuera de la correlación; los pesos se renormalizan", () => {
    const corta = especie("FICTICIA-C", 23, 905.61, 1.3, DIAS.slice(200));
    const e = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, -1), corta]);
    const a = analizar(e);
    expect(de(a, "FICTICIA-C").riesgo).toEqual({ estado: "SIN_HISTORIA", motivo: "HISTORIA_CORTA", dias: 100 });
    expect(de(a, "FICTICIA-C").historia).toEqual({ estado: "HISTORIA_CORTA", dias: 100 });
    const r = calculado(a);
    expect(r.correlacion.ids).toEqual(["FICTICIA-A", "FICTICIA-B"]);
    const valor = (id: string) => e.tablero.filas.find((f) => f.instrumentoId === id)!.valor!;
    const cubiertas = valor("FICTICIA-A").add(valor("FICTICIA-B"));
    expect(r.fraccionCubierta).toBe(redondear(cubiertas.div(e.tablero.valorAcciones).toNumber()));
    expect(cubierta(de(a, "FICTICIA-A")).pesoCubierto).toBe(redondear(valor("FICTICIA-A").div(cubiertas).toNumber()));
  });

  it("sin ninguna especie con historia suficiente, el riesgo del portafolio no se calcula", () => {
    expect(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1, DIAS.slice(0, 120))])).riesgo).toEqual({ estado: "SIN_HISTORIA" });
  });

  it("el fondo de la historia no entra: ni en las especies ni en la correlación", () => {
    const valores = Array.from({ length: 420 }, (_, j) => ({ dia: sumar(DIAS[0]!, j), valorUnidad: 13.7 * 1.0001 ** j }));
    const a = analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)], { fondos: [{ tipo: "FONDO", instrumentoId: "FICTICIA-FIC", nombre: "Fondo", unidades: 4613.27, valores }] }));
    expect(a.especies.map((x) => x.instrumentoId)).toEqual(["FICTICIA-A"]);
    expect(calculado(a).correlacion.ids).toEqual(["FICTICIA-A"]);
  });
});

describe("análisis · historia propia, caída y dividendos", () => {
  it("la caída conocida de 25 % y su efecto en el portafolio: −valor × 0,25", () => {
    const precios = [...Array(296).fill(1237.4), 1484.88, 1113.66, 1608.62, 1286.896];
    const e = portafolio([{ id: "FICTICIA-A", cantidad: 37, cierres: serieDePrecios(DIAS, precios) }, especie("FICTICIA-B", 11, 4613.27, 1)]);
    const a = analizar(e);
    const x = de(a, "FICTICIA-A");
    expect(x.historia.estado === "CON_HISTORIA" && x.historia.caidaMaxima).toEqual({ estado: "CAIDA", fraccion: 0.25, pico: iso(DIAS[296]!), valle: iso(DIAS[297]!) });
    const pesos = x.valor!.mul(-0.25);
    expect(x.efectoCaida!.pesos.eq(pesos)).toBe(true);
    expect(x.efectoCaida!.fraccionPortafolio).toBe(redondear(pesos.div(a.valorAcciones).toNumber()));
  });

  it("sin caída, el efecto es cero", () => {
    const sube = { id: "FICTICIA-A", cantidad: 37, cierres: serieDeRetornos(DIAS, 1237.4, Array(299).fill(0.0003)) };
    expect(de(analizar(portafolio([sube])), "FICTICIA-A").efectoCaida).toEqual({ pesos: D(0), fraccionPortafolio: 0 });
  });

  it("el dividendo de 12 meses y la próxima fecha ex salen de la historia", () => {
    const base = especie("FICTICIA-A", 37, 1237.4, 1);
    const hoy = sumar(DIAS.at(-1)!, 1);
    const extra = {
      movimientos: [{ fecha: DIAS[0]!, cantidad: 37n }],
      dividendos: [{ fechaPago: DIAS[280]!, montoNeto: 41.37, decretadoId: null }],
      decretos: [{ id: "FICTICIA-DEC-1", fechaEx: sumar(hoy, 9), fechaPago: sumar(hoy, 23), valorPorAccion: 17.39, recibido: false }],
    };
    const a = analizar(portafolio([{ ...base, extra }], { hoy }));
    const x = de(a, "FICTICIA-A");
    const precio = base.cierres.at(-1)!.precio;
    expect(x.dividendo12m).toEqual({ fraccion: redondear(41.37 / 37 / precio), pagos: 1, conBruto: false, descartados: 0 });
    expect(x.proximaEx).toEqual({ dia: iso(sumar(hoy, 9)), decretoId: "FICTICIA-DEC-1" });
  });

  it("la escisión con el destino tenido no deja el aviso de cierre faltante", () => {
    const origen = { id: "FICTICIA-O", cantidad: 37, cierres: serieDePrecios(DIAS, DIAS.map((_, j) => (j < 200 ? 1237.4 : 742.44))) };
    const destino = { id: "FICTICIA-D", cantidad: 19, cierres: serieDePrecios(DIAS.slice(200), Array(100).fill(742.44)) };
    const a = analizar(portafolio([origen, destino], { historia: { escisiones: [{ origenId: "FICTICIA-O", destinoId: "FICTICIA-D", fecha: DIAS[200]!, razon: 0.5 }] } }));
    expect(a.avisos.map((x) => x.codigo)).not.toContain("ESCISION_SIN_CIERRE_DESTINO");
  });
});

describe("análisis · referencia, sin tenencia, decisiones y avisos", () => {
  it("la referencia es el cierre más reciente; la carga detenida si hay días hábiles sin cierres antes de hoy", () => {
    const ultimo = DIAS.at(-1)!;
    expect(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)])).referencia).toEqual({ dia: iso(ultimo), cargaDetenida: false });
    expect(analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)], { hoy: sumar(ultimo, 30) })).referencia).toEqual({ dia: iso(ultimo), cargaDetenida: true });
    expect(analizar(portafolio([], { hoy: dia("2021-03-17") })).referencia).toBeNull();
  });

  it("las especies sin cantidad viva traen su cierre (para las reglas), con su frescura", () => {
    const ultimo = DIAS.at(-1)!;
    const a = analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)], { cerradas: [cerrada("FICTICIA-Z", { precio: D("905.61"), fecha: ultimo }), cerrada("FICTICIA-Y", null)] }));
    expect(a.sinTenencia).toEqual([
      { instrumentoId: "FICTICIA-Y", cierre: { estado: "SIN_CIERRE" } },
      { instrumentoId: "FICTICIA-Z", cierre: { estado: "AL_DIA", dia: iso(ultimo), precio: D("905.61") } },
    ]);
  });

  it("el resumen de las decisiones es el de resumirDecisiones", () => {
    const decisiones = [decision("FICTICIA-DEC-A", horizonte(30), horizonte(90, { veredicto: "NO_FUNCIONO", pesos: "-1237.41" }))];
    const a = analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1)], { decisiones }));
    expect(a.decisiones).toEqual(resumirDecisiones(decisiones));
  });

  it("los avisos de las historias salen una sola vez y ordenados", () => {
    const a = analizar(portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2)], { historia: { noHabiles: [] } }));
    const claves = a.avisos.map((x) => `${x.codigo}|${x.instrumentoId}|${x.dia}|${x.dato}`);
    expect(claves).toEqual([...new Set(claves)]);
    expect(a.avisos.filter((x) => x.codigo === "ANIO_SIN_CALENDARIO").map((x) => x.dato)).toEqual([2019, 2020]);
    expect(claves).toEqual([...claves].sort());
  });

  it("valida las entradas antes de calcular", () => {
    const e = portafolio([especie("FICTICIA-A", 37, 1237.4, 1)]);
    expect(() => analizar({ ...e, hoy: new Date(e.hoy.getTime() + 1) })).toThrow(RangeError);
  });
});

describe("análisis · JSON y determinismo", () => {
  const entrada = (): EntradasAnalisis =>
    portafolio(
      [especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, -1.7), especie("FICTICIA-C", 23, 905.61, 0.4), especie("FICTICIA-E", 7, 3791.17, 1.1, DIAS.slice(150))],
      { decisiones: [decision("FICTICIA-DEC-A", horizonte(30), horizonte(90)), decision("FICTICIA-DEC-B", horizonte(30, { veredicto: "NEUTRO", pesos: "0" }), horizonte(90))] },
    );

  it("sin NaN, infinitos ni undefined; el dinero en Decimal", () => {
    const malos: string[] = [];
    const recorrer = (v: unknown, ruta: string): void => {
      if (v === undefined || (typeof v === "number" && !Number.isFinite(v))) malos.push(ruta);
      else if (v instanceof Prisma.Decimal) return;
      else if (Array.isArray(v)) v.forEach((x, i) => recorrer(x, `${ruta}[${i}]`));
      else if (v !== null && typeof v === "object") Object.entries(v).forEach(([k, x]) => recorrer(x, `${ruta}.${k}`));
    };
    const a = analizar(entrada());
    recorrer(a, "analisis");
    expect(malos).toEqual([]);
    expect(a.valorAcciones).toBeInstanceOf(Prisma.Decimal);
  });

  it("la misma entrada da la misma salida, aunque cambie el orden de posiciones, filas y decisiones", () => {
    const e = entrada();
    const otra: EntradasAnalisis = {
      ...e,
      historia: { ...e.historia, posiciones: [...e.historia.posiciones].reverse() },
      tablero: { ...e.tablero, filas: [...e.tablero.filas].reverse() },
      decisiones: [...e.decisiones].reverse(),
    };
    expect(analizar(e)).toStrictEqual(analizar(entrada()));
    expect(analizar(otra)).toStrictEqual(analizar(e));
  });
});
