// El precio actual de trii Pro en el simulador «¿Y si…?»: un campo opcional con validación estricta (positivo, hasta dos
// decimales y un tope), que valora la especie operada a ese precio en lugar del último cierre, lo dice en el informe y
// no se guarda. Datos inventados (FICTICIA-*, 2027).
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { aRespuestaSimulacion, textoPrecioEscrito, NOTA_VALORACION_CON_PRECIO } from "@/app/operar/serializar-simulacion";
import { PRECIO_ACTUAL_MAX, leerPedidoSimulacion, CLAVES_SIMULACION } from "@/operar/pantalla/entrada";
import { conPrecioActual } from "@/operar/pantalla/precio-actual";
import { tableroConPrecioActual } from "@/operar/analisis/precio-actual";
import { portafolioDespues } from "@/operar/analisis/despues";
import { analizar } from "@/analisis/analizar";
import { simularOperacion } from "@/operar/simulador/simular";
import type { EstadoSimulado } from "@/operar/simulador/tipos";
import { diasHabiles, portafolio, retornosRepetidos, serieDeRetornos } from "../../analisis/fixtures/portafolio.ficticio";
import { prohibidasEn } from "../informe/lenguaje";
import { A, B, CONTEXTO, D, ESTADO, idDe, operacion } from "../simulador/apoyo/estado.ficticio";

const cuerpo = (cambios: Record<string, unknown> = {}) => ({
  instrumentoId: idDe(A), lado: "COMPRAR", cantidad: "3", precioLimite: "4.613,27", comisionista: "TRII", saldoComisionista: "", precioActual: "", ...cambios,
});
const leer = (precioActual: unknown) => leerPedidoSimulacion(cuerpo({ precioActual }));

describe("el pedido: la clave «precioActual»", () => {
  it("son siete claves exactas: sin ella, o con otra de más, no se lee", () => {
    expect(CLAVES_SIMULACION).toContain("precioActual");
    const { precioActual: _quitada, ...sin } = cuerpo();
    expect(leerPedidoSimulacion(sin)).toBeNull();
    expect(leerPedidoSimulacion({ ...cuerpo(), otra: "x" })).toBeNull();
  });

  it("vacío (o solo espacios) es null: se usa el último cierre", () => {
    for (const v of ["", "   "]) {
      const r = leer(v);
      expect(r?.ok && r.valor.precioActual).toBeNull();
    }
  });

  it("escrito, se lee como en la ficha: «2.345,5» es 2345.5", () => {
    const r = leer("2.345,5");
    expect(r?.ok && r.valor.precioActual?.toFixed()).toBe("2345.5");
    const entero = leer("913");
    expect(entero?.ok && entero.valor.precioActual?.toFixed()).toBe("913");
  });

  it("estricto: cero, negativo, ilegible, de más de dos decimales, por encima del tope o que no es texto se rechazan con su campo", () => {
    for (const malo of ["0", "0,00", "-5", "abc", "12,345", "1.000.001", "9".repeat(33), 5, null, {}, "1e3", "2.345,5 $"]) {
      expect(leer(malo), String(malo)).toEqual({ ok: false, campos: ["precioActual"] });
    }
  });

  it("el tope es de un millón de pesos por acción, y ese valor sí entra", () => {
    expect(PRECIO_ACTUAL_MAX.toFixed()).toBe(String(10 ** 6));
    const r = leer("1.000.000");
    expect(r?.ok && r.valor.precioActual?.toFixed()).toBe(PRECIO_ACTUAL_MAX.toFixed());
    expect(leer("1.000.000,01")).toEqual({ ok: false, campos: ["precioActual"] });
  });

  it("si falla otro campo y también este, salen los dos", () => {
    expect(leerPedidoSimulacion(cuerpo({ cantidad: "x", precioActual: "-1" }))).toEqual({ ok: false, campos: ["cantidad", "precioActual"] });
  });
});

describe("conPrecioActual: la especie operada se valora con el precio escrito", () => {
  const estado: EstadoSimulado = { ...ESTADO };

  it("cambia solo el precio de esa especie y no muta el estado", () => {
    const copia = JSON.stringify(estado.posiciones, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    const nuevo = conPrecioActual(estado, idDe(A), D("2000.5"));
    expect(nuevo.posiciones.find((p) => p.instrumentoId === idDe(A))?.cierre?.precio.toFixed()).toBe("2000.5");
    expect(nuevo.posiciones.find((p) => p.instrumentoId === idDe(B))?.cierre?.precio.toFixed()).toBe("11.71");
    expect(nuevo.caja).toBe(estado.caja);
    expect(JSON.stringify(estado.posiciones, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).toBe(copia);
  });

  it("una especie sin cierre queda valorada con el precio escrito; una desconocida no cambia nada", () => {
    const sinCierre: EstadoSimulado = { ...estado, posiciones: [{ instrumentoId: "id-x", nemotecnico: "FICTICIA-X", cantidad: 5n, cierre: null }] };
    expect(conPrecioActual(sinCierre, "id-x", D("10")).posiciones[0]?.cierre?.precio.toFixed()).toBe("10");
    expect(conPrecioActual(estado, "id-que-no-existe", D("10"))).toEqual(estado);
  });

  it("el motor valora la acción con ese precio: valor de las acciones, pesos y caja de después", () => {
    const con = conPrecioActual(estado, idDe(A), D("5000"));
    const r = simularOperacion(con, operacion(A, "COMPRAR", 3n, "5000"), { ...CONTEXTO, ordenes: [] });
    expect(r.ok && r.simulacion.valorAccionesAntes.toFixed()).toBe(D("5000").mul(1237).add(D("11.71").mul(379)).toFixed());
  });
});

describe("tableroConPrecioActual: el análisis del antes y el después usa el mismo precio", () => {
  const DIAS = diasHabiles("2019-01-02", 300);
  const especie = (id: string, cantidad: number, inicial: number, escala: number) => ({ id, cantidad, cierres: serieDeRetornos(DIAS, inicial, retornosRepetidos(DIAS.length - 1, escala)) });
  const ENTRADAS = portafolio([especie("FICTICIA-A", 37, 1237.4, 1), especie("FICTICIA-B", 11, 4613.27, 2.3)]);

  it("recalcula el valor y el peso de la especie, el de las demás y el valor de las acciones", () => {
    const t = tableroConPrecioActual(ENTRADAS.tablero, "FICTICIA-B", D("9000"));
    const b = t.filas.find((f) => f.instrumentoId === "FICTICIA-B")!;
    expect(b.cierre?.precio.toFixed()).toBe("9000");
    expect(b.valor?.toFixed()).toBe("99000");
    const a = t.filas.find((f) => f.instrumentoId === "FICTICIA-A")!;
    expect(t.valorAcciones.toFixed()).toBe(b.valor!.add(a.valor!).toFixed());
    expect(b.pesoPct?.toFixed(6)).toBe(b.valor!.div(t.valorAcciones).mul(100).toFixed(6));
    expect(a.pesoPct?.toFixed(6)).toBe(a.valor!.div(t.valorAcciones).mul(100).toFixed(6));
    expect(t.sinVender.toFixed()).toBe(t.filas.reduce((s, f) => s.add(f.sinVender ?? 0), new Prisma.Decimal(0)).toFixed());
  });

  it("no muta el tablero de entrada, y con ese tablero el motor y el portafolio simulado cuadran con el precio escrito", () => {
    const antes = JSON.stringify(ENTRADAS.tablero, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
    const t = tableroConPrecioActual(ENTRADAS.tablero, "FICTICIA-B", D("9000"));
    expect(JSON.stringify(ENTRADAS.tablero, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).toBe(antes);
    const base = { ...ENTRADAS, tablero: t };
    const despues = portafolioDespues(base, "FICTICIA-B", 21n);
    expect(despues.tablero.filas.find((f) => f.instrumentoId === "FICTICIA-B")?.valor?.toFixed()).toBe("189000");
    expect(analizar(base).especies.find((e) => e.instrumentoId === "FICTICIA-B")?.valor?.toFixed()).toBe("99000");
  });

  it("una especie que no está en el tablero no cambia nada", () => {
    expect(tableroConPrecioActual(ENTRADAS.tablero, "FICTICIA-Z", D("1")).valorAcciones.toFixed()).toBe(ENTRADAS.tablero.valorAcciones.toFixed());
  });
});

describe("el informe lo dice", () => {
  const FECHA = new Date(Date.UTC(2027, 2, 12));
  const respuesta = (precio: string) => {
    const estado = conPrecioActual(ESTADO, idDe(A), D(precio));
    const op = operacion(A, "COMPRAR", 3n, "4613.27");
    return aRespuestaSimulacion(simularOperacion(estado, op, CONTEXTO), idDe(A), estado.posiciones, "ESCRITA", null, { precio: D(precio), cierreFecha: FECHA });
  };

  it("«Valorado con el precio escrito: $ X (trii Pro), no con el cierre del dd-mmm-aaaa» y la valoración de las demás", () => {
    expect(textoPrecioEscrito(D("2345.5"), FECHA)).toBe("Valorado con el precio escrito: $ 2.345,5 (trii Pro), no con el cierre del 12-mar-2027.");
    expect(textoPrecioEscrito(D("2345.5"), null)).toBe("Valorado con el precio escrito: $ 2.345,5 (trii Pro); la especie no tiene cierre guardado.");
    expect(NOTA_VALORACION_CON_PRECIO).toBe("Es el precio de la especie operada; las demás se valoran a su último cierre y la caja se mueve al precio límite de la orden.");
    const r = respuesta("2000");
    expect(r.ok && r.vista.notas.slice(0, 2)).toEqual([textoPrecioEscrito(D("2000"), FECHA), NOTA_VALORACION_CON_PRECIO]);
    expect(r.ok && r.vista.notas).toHaveLength(3);
  });

  it("con precio escrito, una nota fija dice que los escenarios parten de la historia de cierres", () => {
    const r = respuesta("2000");
    expect(r.ok && r.vista.notas).toContain("Los escenarios a 12 meses parten de la historia de cierres; el precio escrito solo cuenta en el valor de partida si la especie no tiene historia de cierres.");
  });

  it("sin precio escrito, la nota es la de siempre (el último cierre)", () => {
    const op = operacion(A, "COMPRAR", 3n, "4613.27");
    const r = aRespuestaSimulacion(simularOperacion(ESTADO, op, CONTEXTO), idDe(A), ESTADO.posiciones, "ESCRITA");
    expect(r.ok && r.vista.notas[0]).toBe("Las acciones se valoran a su último cierre; la caja se mueve al precio límite de la orden.");
    expect(r.ok && r.vista.notas.some((nota) => nota.includes("escenarios a 12 meses"))).toBe(false);
  });

  it("el valor de las acciones de la vista sale del precio escrito", () => {
    const r = respuesta("2000");
    expect(r.ok && r.vista.valorAccionesAntes).toBe("$ 2.478.438");
  });

  it("ningún texto nuevo aconseja (con control positivo)", () => {
    expect(prohibidasEn("Le conviene escribir el precio.")).not.toEqual([]);
    expect(prohibidasEn(textoPrecioEscrito(D("2345.5"), FECHA))).toEqual([]);
    expect(prohibidasEn(NOTA_VALORACION_CON_PRECIO)).toEqual([]);
  });
});
