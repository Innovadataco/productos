// Cómo se arma la historia de retornos: rejilla de días hábiles, ventana común, elegibilidad (N días), arrastre del
// último precio, el fondo alineado a la rejilla y los casos borde (sin historia, un día, fondo sin valores). Puro.
import { describe, expect, it } from "vitest";
import { armarHistoria } from "@/proyecciones/historia";
import { MINIMO_DIAS } from "@/proyecciones/metodo";
import type { Cierre } from "@/proyecciones/tipos";
import { accion, dia, diasHabiles, entradas, fondo, iso, serieAleatoria, serieGeometrica, sumar, valoresDiarios } from "./ficticio";

const columna = (h: ReturnType<typeof armarHistoria>, id: string) => h.columnas.findIndex((c) => c.instrumentoId === id);
const factor = (h: ReturnType<typeof armarHistoria>, id: string, d: string) => {
  const j = h.historia.dias.indexOf(d);
  if (j < 1) throw new Error(`el día ${d} no tiene retorno en la ventana`);
  return h.historia.factores[(j - 1) * h.historia.K + columna(h, id)]!;
};
const posicion = (h: ReturnType<typeof armarHistoria>, id: string) => h.posiciones.find((p) => p.instrumentoId === id)!;
const cerca = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe("armarHistoria · rejilla y ventana", () => {
  it("el mínimo de historia es de 250 días con cierre", () => {
    expect(MINIMO_DIAS).toBe(250);
  });

  it("fin de semana y festivo sembrado no entran en la rejilla aunque traigan cierre", () => {
    const todos: Cierre[] = Array.from({ length: 420 }, (_, j) => ({ dia: sumar(dia("2019-01-02"), j), precio: 1237.4 + j * 0.31 }));
    const h = armarHistoria(entradas([accion("a", 37, todos)]));
    expect(h.historia.dias.some((d) => [0, 6].includes(dia(d).getUTCDay()))).toBe(false);
    expect(h.historia.dias).not.toContain("2019-06-12");
    expect(posicion(h, "a").estado).toBe("PROYECTADA");
  });

  it("la rejilla sale solo de las especies elegibles: los días de una fija no entran", () => {
    const dias = diasHabiles("2019-01-02", 320);
    const propiosA = dias.filter((_, j) => j % 7 !== 3);
    const soloB = dias.filter((_, j) => j % 7 === 3).slice(0, 40);
    const h = armarHistoria(entradas([accion("a", 37, serieGeometrica(propiosA, 1237.4, 1.0002)), accion("b", 11, serieGeometrica(soloB, 811.9, 1))]));
    expect(posicion(h, "b").estado).toBe("FIJA_HISTORIA_CORTA");
    expect(h.historia.dias.some((d) => soloB.map(iso).includes(d))).toBe(false);
    expect(h.historia.K).toBe(1);
  });

  it("un día sin cierre arrastra el precio (factor 1) y el siguiente lleva todo el movimiento", () => {
    const dias = diasHabiles("2019-01-02", 330);
    const c = serieAleatoria(dias.filter((_, j) => j % 15 !== 4), 905.61, 7);
    const h = armarHistoria(entradas([accion("a", 37, serieAleatoria(dias, 1237.4, 3)), accion("c", 19, c)]));
    expect(factor(h, "c", iso(dias[19]!))).toBe(1);
    const k = columna(h, "c");
    let producto = 1;
    for (let t = 0; t < h.historia.T; t += 1) producto *= h.historia.factores[t * h.historia.K + k]!;
    cerca(producto, c.at(-1)!.precio / c[0]!.precio);
  });

  it("249 días: queda fija; 250: se proyecta", () => {
    const dias = diasHabiles("2019-01-02", 250);
    const corta = armarHistoria(entradas([accion("x", 13, serieGeometrica(dias.slice(1), 1237.4, 1.0001))]));
    expect(posicion(corta, "x")).toMatchObject({ estado: "FIJA_HISTORIA_CORTA", diasTotales: 249 });
    expect(corta.historia.K).toBe(0);
    expect(corta.ventana).toBeNull();
    const justa = armarHistoria(entradas([accion("y", 13, serieGeometrica(dias, 1237.4, 1.0001))]));
    expect(posicion(justa, "y")).toMatchObject({ estado: "PROYECTADA", diasTotales: 250, diasEnVentana: 250 });
    expect(justa.historia.T).toBe(249);
  });

  it("la ventana empieza en el primer cierre más tardío entre las elegibles y dice cuál la limita; sin cascada", () => {
    const dias = diasHabiles("2018-01-02", 700);
    const a = serieAleatoria(dias, 1237.4, 11);
    const b = serieAleatoria(dias.slice(390), 4613.27, 13);
    const dispersa = serieAleatoria(dias.filter((_, j) => j % 2 === 0 && j < 520), 311.9, 17);
    const h = armarHistoria(entradas([accion("a", 37, a), accion("b", 3, b), accion("s", 41, dispersa)]));
    expect(h.ventana).toMatchObject({ desde: iso(dias[390]!), hasta: iso(dias.at(-1)!), ruedas: 310, limitadaPor: "B" });
    expect(posicion(h, "a")).toMatchObject({ estado: "PROYECTADA", diasTotales: 700, diasEnVentana: 310 });
    expect(posicion(h, "b")).toMatchObject({ estado: "PROYECTADA", diasEnVentana: 310 });
    expect(posicion(h, "s")).toMatchObject({ estado: "FIJA_HISTORIA_CORTA", diasTotales: 260 });
    expect(posicion(h, "s").diasEnVentana).toBeLessThan(MINIMO_DIAS);
  });

  it("ruedas por mes = retornos de la ventana / meses de la ventana", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const h = armarHistoria(entradas([accion("a", 37, serieAleatoria(dias, 1237.4, 5))]));
    const meses = (dias.at(-1)!.getTime() - dias[0]!.getTime()) / 86_400_000 / (365.25 / 12);
    cerca(h.historia.ruedasPorMes, 299 / meses);
  });

  it("los cierres posteriores a hoy no cuentan", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const h = armarHistoria(entradas([accion("a", 37, serieGeometrica(dias, 1237.4, 1.001))], { hoy: dias[279]! }));
    expect(posicion(h, "a")).toMatchObject({ diasTotales: 280, ultimoDia: iso(dias[279]!) });
    cerca(h.columnas[0]!.valorHoy, 37 * 1237.4 * 1.001 ** 279);
  });
});

describe("armarHistoria · fondo", () => {
  it("se alinea a la rejilla de las acciones: el fin de semana se acumula en el lunes", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const h = armarHistoria(entradas([accion("a", 37, serieAleatoria(dias, 1237.4, 5)), fondo("f", 1499.927, valoresDiarios("2018-12-01", 460, 12_731.4419, 1.0002))]));
    const lunes = iso(dias.find((d, j) => j > 0 && d.getUTCDay() === 1)!);
    cerca(factor(h, "f", lunes), 1.0002 ** 3);
    expect(posicion(h, "f")).toMatchObject({ tipo: "FONDO", estado: "PROYECTADA" });
  });

  it("sin acciones elegibles, la rejilla es la de los días hábiles del fondo", () => {
    const h = armarHistoria(entradas([fondo("f", 1499.927, valoresDiarios("2019-01-01", 400, 12_731.4419, 1.0002))]));
    expect(h.historia.K).toBe(1);
    expect(h.historia.dias.every((d) => ![0, 6].includes(dia(d).getUTCDay()))).toBe(true);
    expect(posicion(h, "f").diasTotales).toBe(h.historia.dias.length);
  });
});

describe("armarHistoria · casos borde y valor de hoy", () => {
  it("especie sin historia y fondo sin valores: no se pueden valorar y quedan fuera, con aviso", () => {
    const h = armarHistoria(entradas([accion("v", 37, []), fondo("g", 311.7, [])]));
    expect(posicion(h, "v")).toMatchObject({ estado: "EXCLUIDA_SIN_VALOR", valorHoy: null, peso: null, diasTotales: 0, ultimoDia: null });
    expect(posicion(h, "g")).toMatchObject({ estado: "EXCLUIDA_SIN_VALOR", valorHoy: null });
    expect(h.avisos.filter((a) => a.codigo === "SIN_VALOR").map((a) => a.instrumentoId).sort()).toEqual(["g", "v"]);
    expect(h.valorFijo).toBe(0);
    expect(h.historia.K).toBe(0);
  });

  it("un solo día: se valora con ese cierre y queda fija", () => {
    const h = armarHistoria(entradas([accion("u", 37, [{ dia: dia("2019-03-05"), precio: 4613.27 }])]));
    expect(posicion(h, "u")).toMatchObject({ estado: "FIJA_HISTORIA_CORTA", diasTotales: 1, valorHoy: 37 * 4613.27, peso: 1 });
    expect(h.valorFijo).toBe(37 * 4613.27);
    expect(h.avisos.map((a) => a.codigo)).toContain("HISTORIA_CORTA");
  });

  it("valor de hoy y pesos: cantidad × último cierre y unidades × último valor de unidad", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const vu = valoresDiarios("2018-12-01", 460, 12_731.4419, 1.0002);
    const h = armarHistoria(entradas([accion("a", 37, serieGeometrica(dias, 1237.4, 1.0003)), fondo("f", 1499.927, vu), accion("u", 5, [{ dia: dias[7]!, precio: 811.3 }])]));
    const a = 37 * 1237.4 * 1.0003 ** 299;
    const f = 1499.927 * vu.at(-1)!.valorUnidad;
    const u = 5 * 811.3;
    cerca(posicion(h, "a").valorHoy!, a);
    cerca(posicion(h, "f").valorHoy!, f);
    cerca(posicion(h, "u").peso!, u / (a + f + u));
    cerca(h.valorFijo, u);
  });

  it("avisa los años sin calendario sembrado y las especies incompletas", () => {
    const dias = diasHabiles("2019-01-02", 300);
    const h = armarHistoria(entradas([accion("a", 37, serieAleatoria(dias, 1237.4, 5))], { noHabiles: [dia("2020-06-17")], incompletas: ["ZQX"] }));
    expect(h.avisos).toContainEqual({ codigo: "ANIO_SIN_CALENDARIO", instrumentoId: null, nombre: null, dia: null, dato: 2019 });
    expect(h.avisos).toContainEqual({ codigo: "ESPECIE_INCOMPLETA", instrumentoId: null, nombre: "ZQX", dia: null, dato: null });
  });
});
