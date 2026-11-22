// Ajustes de los retornos de cierres SIN ajustar: la escisión (lo recibido del destino compensa la caída del origen)
// y los saltos que ningún evento explica. Puro, por medio de armarHistoria.
import { describe, expect, it } from "vitest";
import { armarHistoria } from "@/proyecciones/historia";
import { SALTO_MAX, SALTO_MIN } from "@/proyecciones/metodo";
import type { Cierre, EscisionLeida } from "@/proyecciones/tipos";
import { accion, dia, diasHabiles, entradas, iso, serieGeometrica } from "./ficticio";

const dias = diasHabiles("2019-01-02", 300);
const EVENTO = dias[200]!;
/** El origen cae a `caida` de su precio desde el día del evento (sin ajustar). */
const origen = (caida: number, sinDia?: Date): Cierre[] =>
  serieGeometrica(dias, 1237.4, 1.0003)
    .map((c, j) => (j >= 200 ? { ...c, precio: c.precio * caida } : c))
    .filter((c) => !sinDia || c.dia.getTime() !== sinDia.getTime());
const destino = (desde: number, base: number): Cierre[] => serieGeometrica(dias.slice(desde), base, 1.0001);
const escision = (destinoId: string, razon: number | null, fecha = EVENTO, origenId = "o"): EscisionLeida => ({ origenId, destinoId, fecha, razon });

function armar(cierresOrigen: Cierre[], escisiones: EscisionLeida[], cierresDestino: Record<string, Cierre[]>, extra: Parameters<typeof accion>[] = []) {
  const h = armarHistoria(entradas([accion("o", 311, cierresOrigen), ...extra.map((x) => accion(...x))], { escisiones, cierresDestino }));
  const k = h.columnas.findIndex((c) => c.instrumentoId === "o");
  const f = (d: Date) => h.historia.factores[(h.historia.dias.indexOf(iso(d)) - 1) * h.historia.K + k]!;
  return { h, f };
}
const p = (cierres: Cierre[], d: Date) => cierres.find((c) => c.dia.getTime() === d.getTime())!.precio;

describe("ajuste por escisión", () => {
  it("el factor del día suma lo recibido: (P_o + razón × P_d) / P_o del día anterior", () => {
    const o = origen(0.61);
    const d = destino(200, 812.3);
    const { f, h } = armar(o, [escision("d", 0.37)], { d });
    expect(f(EVENTO)).toBeCloseTo((p(o, EVENTO) + 0.37 * p(d, EVENTO)) / p(o, dias[199]!), 12);
    expect(h.avisos.filter((a) => a.codigo.startsWith("ESCISION") || a.codigo === "SALTO_SIN_EVENTO")).toEqual([]);
  });

  it("dos destinos el mismo día se suman", () => {
    const o = origen(0.43);
    const d1 = destino(200, 812.3);
    const d2 = destino(200, 97.41);
    const { f } = armar(o, [escision("d1", 0.37), escision("d2", 1.13)], { d1, d2 });
    expect(f(EVENTO)).toBeCloseTo((p(o, EVENTO) + 0.37 * p(d1, EVENTO) + 1.13 * p(d2, EVENTO)) / p(o, dias[199]!), 12);
  });

  it("sin razón, sin cierre del destino ese día o encadenada el mismo día: el día queda en 1 y se avisa", () => {
    const o = origen(0.3);
    const sinRazon = armar(o, [escision("d", null)], { d: destino(200, 812.3) });
    expect(sinRazon.f(EVENTO)).toBe(1);
    expect(sinRazon.h.avisos.map((a) => [a.codigo, a.instrumentoId, a.dia])).toEqual([["ESCISION_SIN_RAZON", "o", iso(EVENTO)]]);

    const sinCierre = armar(o, [escision("d", 0.37)], { d: destino(201, 812.3) });
    expect(sinCierre.f(EVENTO)).toBe(1);
    expect(sinCierre.h.avisos.map((a) => a.codigo)).toEqual(["ESCISION_SIN_CIERRE_DESTINO"]);

    const cadena = armar(o, [escision("d", 0.37), escision("e", 0.5, EVENTO, "d")], { d: destino(200, 812.3), e: destino(200, 41.9) });
    expect(cadena.f(EVENTO)).toBe(1);
    expect(cadena.h.avisos.map((a) => a.codigo)).toEqual(["ESCISION_ENCADENADA"]);
  });

  it("si el origen no cotiza el día del evento, se ajusta su primer cierre posterior", () => {
    const o = origen(0.61, EVENTO);
    const d = destino(200, 812.3);
    const { f } = armar(o, [escision("d", 0.37)], { d }, [["a", 7, serieGeometrica(dias, 905.6, 1.0002)]]);
    expect(f(EVENTO)).toBe(1);
    expect(f(dias[201]!)).toBeCloseTo((p(o, dias[201]!) + 0.37 * p(d, dias[201]!)) / p(o, dias[199]!), 12);
  });

  it("un evento anterior a la ventana no se usa", () => {
    const o = serieGeometrica(dias, 1237.4, 1.0003);
    const { f, h } = armar(o, [escision("d", 0.37, dia("2018-07-11"))], { d: destino(0, 812.3) });
    expect(f(dias[1]!)).toBeCloseTo(1.0003, 12);
    expect(h.avisos).toEqual([]);
  });
});

describe("saltos sin evento", () => {
  it("un factor fuera de [0,5; 2] que ninguna escisión explica queda en 1 y se avisa; dentro del rango, no", () => {
    expect([SALTO_MIN, SALTO_MAX]).toEqual([0.5, 2]);
    const base = serieGeometrica(dias, 1237.4, 1.0003);
    let escala = 1;
    const o = base.map((c, j) => {
      if (j === 50) escala *= 0.4;
      if (j === 80) escala *= 0.6;
      if (j === 120) escala *= 2.5;
      return { ...c, precio: c.precio * escala };
    });
    const { f, h } = armar(o, [], {});
    expect(f(dias[50]!)).toBe(1);
    expect(f(dias[120]!)).toBe(1);
    expect(f(dias[80]!)).toBeCloseTo(0.6 * 1.0003, 12);
    expect(h.avisos.map((a) => [a.codigo, a.dia])).toEqual([["SALTO_SIN_EVENTO", iso(dias[50]!)], ["SALTO_SIN_EVENTO", iso(dias[120]!)]]);
  });

  it("el día de una escisión ajustada o neutralizada no se marca como salto", () => {
    const o = origen(0.3);
    const ajustada = armar(o, [escision("d", 2.31)], { d: destino(200, 812.3) });
    expect(ajustada.h.avisos).toEqual([]);
    const neutralizada = armar(o, [escision("d", null)], { d: destino(200, 812.3) });
    expect(neutralizada.h.avisos.map((a) => a.codigo)).toEqual(["ESCISION_SIN_RAZON"]);
  });
});
