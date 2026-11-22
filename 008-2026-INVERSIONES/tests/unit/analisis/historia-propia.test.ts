// Historia propia de una especie con armarHistoria: con y sin historia suficiente, la caída conocida y la escisión
// cuyo destino también se tiene. Puro.
import { describe, expect, expectTypeOf, it } from "vitest";
import { historiaPropia } from "@/analisis/historia-propia";
import type { EntradasProyeccion } from "@/proyecciones/tipos";
import { accion, diasHabiles, FESTIVOS_FICTICIOS, iso, serieDePrecios, serieDeRetornos, sumar } from "./fixtures/portafolio.ficticio";

const entradas = (posiciones: EntradasProyeccion["posiciones"], extra: Partial<EntradasProyeccion> = {}): EntradasProyeccion => ({
  hoy: sumar(diasHabiles("2019-01-02", 400).at(-1)!, 3), posiciones, escisiones: [], cierresDestino: {}, noHabiles: FESTIVOS_FICTICIOS, incompletas: [], ...extra,
});

describe("historia propia", () => {
  it("con 300 días: desde, hasta, días, las cuatro ventanas y sin caída en una serie que solo sube", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const a = accion("FICTICIA-A", 37, serieDeRetornos(dias, 1237.4, Array(299).fill(0.0003)));
    const { historia } = historiaPropia(entradas([a]), a);
    if (historia.estado !== "CON_HISTORIA") throw new Error("debía tener historia");
    expect(historia).toMatchObject({ desde: iso(dias[0]!), hasta: iso(dias.at(-1)!), dias: 300, caidaMaxima: { estado: "SIN_CAIDA" } });
    expect(historia.ventanas.map((v) => v.estado)).toEqual(["CALCULADA", "CALCULADA", "CALCULADA", "CALCULADA"]);
    expectTypeOf(historia.ventanas[3].meses).toEqualTypeOf<12>();
    expectTypeOf(historia.ventanas).toHaveProperty("length").toEqualTypeOf<4>();
  });

  it("con 249 días es corta; sin cierres, sin cierres", () => {
    const a = accion("FICTICIA-A", 37, serieDeRetornos(diasHabiles("2019-01-02", 249), 1237.4, Array(248).fill(0.0003)));
    expect(historiaPropia(entradas([a]), a).historia).toEqual({ estado: "HISTORIA_CORTA", dias: 249 });
    const b = accion("FICTICIA-B", 11, []);
    expect(historiaPropia(entradas([b]), b).historia).toEqual({ estado: "SIN_CIERRES" });
  });

  it("la caída conocida de 25 % se mide de punta a punta, con sus fechas", () => {
    const dias = diasHabiles("2019-01-02", 251);
    const precios = [...Array(246).fill(1237.4), 1484.88, 1113.66, 1608.62, 1286.896, 1301.37];
    const a = accion("FICTICIA-A", 37, serieDePrecios(dias, precios));
    const { historia } = historiaPropia(entradas([a]), a);
    expect(historia.estado === "CON_HISTORIA" && historia.caidaMaxima).toEqual({ estado: "CAIDA", fraccion: 0.25, pico: iso(dias[246]!), valle: iso(dias[247]!) });
  });

  it("la escisión con el destino también tenido usa el cierre del destino (sin aviso de cierre faltante)", () => {
    // El origen pasa de 1237,4 a 742,44 (−40 %) y recibe 0,5 acciones del destino a 742,44: vale 1113,66, −10 %.
    const dias = diasHabiles("2019-01-02", 300);
    const origen = accion("FICTICIA-O", 37, serieDePrecios(dias, dias.map((_, j) => (j < 200 ? 1237.4 : 742.44))));
    const destino = accion("FICTICIA-D", 19, serieDePrecios(dias.slice(200), Array(100).fill(742.44)));
    const e = entradas([origen, destino], { escisiones: [{ origenId: "FICTICIA-O", destinoId: "FICTICIA-D", fecha: dias[200]!, razon: 0.5 }] });
    const r = historiaPropia(e, origen);
    expect(r.avisos.map((a) => a.codigo)).not.toContain("ESCISION_SIN_CIERRE_DESTINO");
    expect(r.historia.estado === "CON_HISTORIA" && r.historia.caidaMaxima).toEqual({ estado: "CAIDA", fraccion: 0.1, pico: iso(dias[0]!), valle: iso(dias[200]!) });
  });

  it("trae los avisos de la historia (un año sin calendario)", () => {
    const a = accion("FICTICIA-A", 37, serieDeRetornos(diasHabiles("2019-01-02", 300), 1237.4, Array(299).fill(0.0003)));
    const r = historiaPropia(entradas([a], { noHabiles: [] }), a);
    expect(r.avisos.map((x) => x.codigo)).toContain("ANIO_SIN_CALENDARIO");
  });
});
