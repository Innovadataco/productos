// @vitest-environment jsdom
// Gráfica de tiempo del módulo reutilizable (frente graficas-tablero): accesible, con mira por puntero y teclado,
// relleno entre curvas, bandas P5–P95 y P25–P75 (para proyecciones), ventana animada y tabla de datos. Inventado.
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraficaTiempo, type PropsGraficaTiempo } from "@/app/_graficas";
import { alternar, desenfocar, enfocar, montar, movimiento, observador, puntero, rectangulo, reloj, tecla, texto, type Montaje } from "./dom";

const DIAS = ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05"];
const base = (o: Partial<PropsGraficaTiempo> = {}): PropsGraficaTiempo => ({
  titulo: "Valor frente al costo",
  resumen: "Del 1 al 5 de marzo el valor pasó de $4613 a $4723.",
  dias: DIAS,
  series: [
    { id: "valor", nombre: "Valor", tono: "valor", valores: [4613, 4701, 4588, 4659, 4723] },
    { id: "costo", nombre: "Costo", tono: "costo", valores: [4517, 4517, 4517, 4641, 4641] },
  ],
  formatoY: (v) => `$${v}`,
  formatoEje: (v) => `e${v}`,
  formatoDia: (d) => `día ${d}`,
  formatoTick: (d, e) => `${e.tipo}:${d}`,
  ...o,
});

let m: Montaje;
beforeEach(() => {
  movimiento(true);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const toque = () => m.contenedor.querySelector<HTMLElement>("[role=group]")!;
const tip = () => m.contenedor.querySelector(".g-tip");
const linea = (id: string) => m.contenedor.querySelector(`path.g-linea[data-serie="${id}"]`)!.getAttribute("d");

describe("GraficaTiempo · accesible", () => {
  it("título y resumen con cifras para el lector de pantalla; el dibujo es decorativo", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    const figura = m.contenedor.querySelector("figure")!;
    const titulo = document.getElementById(figura.getAttribute("aria-labelledby")!);
    expect(texto(titulo)).toBe("Valor frente al costo");
    expect(toque().getAttribute("aria-labelledby")).toBe(figura.getAttribute("aria-labelledby"));
    expect(toque().tabIndex).toBe(0);
    const resumen = document.getElementById(toque().getAttribute("aria-describedby")!);
    expect(texto(resumen)).toContain("pasó de $4613 a $4723");
    expect(texto(resumen)).toContain("flechas");
    expect(m.contenedor.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("con dos o más series, la leyenda da el último valor de la ventana de cada una", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    expect([...m.contenedor.querySelectorAll(".g-leyenda li")].map(texto)).toEqual(["$4723 Valor", "$4641 Costo"]);
    await m.pintar(createElement(GraficaTiempo, base({ ventana: { desde: 0, hasta: 2 } })));
    expect([...m.contenedor.querySelectorAll(".g-leyenda li")].map(texto)).toEqual(["$4588 Valor", "$4517 Costo"]);
  });

  it("con una sola serie no hay leyenda: el título la nombra", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ series: [base().series[0]!] })));
    expect(m.contenedor.querySelector(".g-leyenda")).toBeNull();
  });
});

describe("GraficaTiempo · detalle por teclado y puntero", () => {
  it("al enfocar señala el último día; las flechas, Inicio y Fin recorren y se anuncia; al salir se va", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    await enfocar(toque());
    expect(texto(tip())).toContain("día 2027-03-05");
    expect(texto(tip())).toContain("$4723 Valor");
    expect(texto(tip())).toContain("$4641 Costo");
    await tecla(toque(), "ArrowLeft");
    expect(texto(tip())).toContain("día 2027-03-04");
    const vivo = m.contenedor.querySelector("[aria-live=polite]")!;
    expect(texto(vivo)).toContain("día 2027-03-04");
    expect(texto(vivo)).toContain("$4659 Valor");
    await tecla(toque(), "Home");
    expect(texto(tip())).toContain("día 2027-03-01");
    await tecla(toque(), "Escape");
    expect(tip()).toBeNull();
    await tecla(toque(), "End");
    expect(texto(tip())).toContain("día 2027-03-05");
    await desenfocar(toque());
    expect(tip()).toBeNull();
  });

  it("el puntero se pega al día más cercano; con ratón se va al salir; con el dedo se queda", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    rectangulo(toque(), 500, 20);
    await puntero(toque(), "pointermove", 20 + 250);
    expect(texto(tip())).toContain("día 2027-03-03");
    expect(m.contenedor.querySelectorAll(".g-punto")).toHaveLength(2);
    expect(m.contenedor.querySelector("line.g-mira")).not.toBeNull();
    await puntero(toque(), "salir");
    expect(tip()).toBeNull();
    await puntero(toque(), "pointerdown", 20 + 490, "touch");
    expect(texto(tip())).toContain("día 2027-03-05");
    await puntero(toque(), "salir", 0, "touch");
    expect(texto(tip())).toContain("día 2027-03-05");
    expect(m.contenedor.querySelector("[aria-live=polite]")!.textContent).toBe("");
  });

  it("el detalle se pone del lado que tiene lugar", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    rectangulo(toque(), 500);
    await puntero(toque(), "pointermove", 10);
    expect(tip()!.getAttribute("data-lado")).toBe("der");
    await puntero(toque(), "pointermove", 490);
    expect(tip()!.getAttribute("data-lado")).toBe("izq");
  });

  it("extraDetalle agrega su línea al detalle del día", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ extraDetalle: (i) => (i === 4 ? "1 especie con un cierre anterior" : null) })));
    await enfocar(toque());
    expect(texto(m.contenedor.querySelector(".g-tip-extra"))).toBe("1 especie con un cierre anterior");
    await tecla(toque(), "ArrowLeft");
    expect(m.contenedor.querySelector(".g-tip-extra")).toBeNull();
  });
});

describe("GraficaTiempo · capas", () => {
  it("relleno entre dos series: dos recortes (arriba y abajo) con ids que sirven en url(#…)", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ rellenos: [{ serie: "valor", contra: { serie: "costo" }, arriba: "gana", abajo: "pierde" }] })));
    const recortes = [...m.contenedor.querySelectorAll("clipPath")];
    expect(recortes).toHaveLength(2);
    recortes.forEach((r) => expect(r.id).toMatch(/^[A-Za-z][\w-]*$/));
    const rellenos = [...m.contenedor.querySelectorAll("path.g-relleno")];
    expect(rellenos.map((r) => r.getAttribute("clip-path"))).toEqual(recortes.map((r) => `url(#${r.id})`));
    expect(rellenos.map((r) => r.getAttribute("class"))).toEqual(["g-relleno t-gana", "g-relleno t-pierde"]);
    rellenos.forEach((r) => expect(r.getAttribute("d")).toMatch(/^M.+Z$/));
  });

  it("relleno contra una constante (la TWR contra 0): pinta la línea base", async () => {
    await m.pintar(createElement(GraficaTiempo, base({
      series: [{ id: "twr", nombre: "TWR", tono: "valor", valores: [0, 1.3, -0.7, 0.4, 2.1] }],
      rellenos: [{ serie: "twr", contra: { constante: 0 }, arriba: "gana", abajo: "pierde" }], incluirCero: true,
    })));
    expect(m.contenedor.querySelectorAll("path.g-relleno")).toHaveLength(2);
    expect(m.contenedor.querySelector("line.g-base")).not.toBeNull();
  });

  it("bandas P5–P95 y P25–P75 alrededor de una mediana, con corte en «Hoy», y el detalle da sus rangos", async () => {
    await m.pintar(createElement(GraficaTiempo, base({
      series: [
        { id: "historia", nombre: "Historia", tono: "valor", valores: [4613, 4701, 4588, null, null] },
        { id: "mediana", nombre: "Mediana", tono: "neutro", trazo: "punteado", valores: [null, null, 4588, 4637, 4699] },
      ],
      bandas: [
        { id: "p5", nombre: "P5–P95", tono: "neutro", intensidad: "suave", bajo: [null, null, 4588, 4391, 4207], alto: [null, null, 4588, 4877, 5113] },
        { id: "p25", nombre: "P25–P75", tono: "neutro", intensidad: "media", bajo: [null, null, 4588, 4519, 4467], alto: [null, null, 4588, 4751, 4903] },
      ],
      corte: { indice: 2, nombre: "Hoy" },
    })));
    expect(m.contenedor.querySelector("path.g-banda-suave")!.getAttribute("d")).toMatch(/^M.+Z$/);
    expect(m.contenedor.querySelector("path.g-banda-media")!.getAttribute("d")).toMatch(/^M.+Z$/);
    expect(m.contenedor.querySelector("path.g-linea.g-punteado")).not.toBeNull();
    expect(texto(m.contenedor.querySelector(".g-corte"))).toBe("Hoy");
    await enfocar(toque());
    expect(texto(tip())).toContain("$4699 Mediana");
    expect(texto(tip())).toContain("$4207 – $5113 P5–P95");
    expect(texto(tip())).toContain("$4467 – $4903 P25–P75");
    expect(texto(tip())).not.toContain("Historia");
  });

  it("un null corta la línea en dos tramos", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ series: [{ id: "valor", nombre: "Valor", tono: "valor", valores: [4613, 4701, null, 4659, 4723] }] })));
    expect(linea("valor")!.match(/M/g)).toHaveLength(2);
  });
});

describe("GraficaTiempo · ventana y movimiento", () => {
  it("la ventana define los ejes; con «reducir movimiento» el cambio es inmediato", async () => {
    await m.pintar(createElement(GraficaTiempo, base()));
    const ticks = () => [...m.contenedor.querySelectorAll(".g-tick-x")].map(texto);
    const completo = ticks();
    const dCompleto = linea("valor");
    await m.pintar(createElement(GraficaTiempo, base({ ventana: { desde: 3, hasta: 4 } })));
    expect(ticks()).not.toEqual(completo);
    expect(ticks()[0]).toBe("dia:2027-03-04");
    expect(linea("valor")).not.toBe(dCompleto);
  });

  it("sin «reducir movimiento», el cambio de ventana se anima por cuadros y termina en el trazo exacto", async () => {
    const otra = montar();
    await otra.pintar(createElement(GraficaTiempo, base({ ventana: { desde: 3, hasta: 4 } })));
    const dFinal = otra.contenedor.querySelector('path.g-linea[data-serie="valor"]')!.getAttribute("d");
    otra.desmontar();

    movimiento(false);
    const r = reloj();
    await m.pintar(createElement(GraficaTiempo, base()));
    const dInicial = linea("valor");
    await m.pintar(createElement(GraficaTiempo, base({ ventana: { desde: 3, hasta: 4 } })));
    await r.avanzar(16);
    await r.avanzar(150);
    const dMedio = linea("valor");
    expect(dMedio).not.toBe(dInicial);
    expect(dMedio).not.toBe(dFinal);
    await r.avanzar(2000);
    expect(linea("valor")).toBe(dFinal);
    expect(r.pendientes()).toBe(0);
  });

  it("aparece al entrar en pantalla (IntersectionObserver); sin él, aparece de una", async () => {
    const io = observador();
    await m.pintar(createElement(GraficaTiempo, base()));
    const plot = m.contenedor.querySelector(".g-plot")!;
    expect(plot.hasAttribute("data-visible")).toBe(false);
    await io.entrar();
    expect(plot.hasAttribute("data-visible")).toBe(true);
    m.desmontar();
    expect(io.desconectados()).toBeGreaterThan(0);
    vi.unstubAllGlobals();
    movimiento(true);
    m = montar();
    await m.pintar(createElement(GraficaTiempo, base()));
    expect(m.contenedor.querySelector(".g-plot")!.hasAttribute("data-visible")).toBe(true);
  });
});

describe("GraficaTiempo · datos", () => {
  it("la tabla aparece solo al abrir «Ver los datos», con una fila por día de la ventana", async () => {
    await m.pintar(createElement(GraficaTiempo, base({ ventana: { desde: 1, hasta: 4 } })));
    const detalles = m.contenedor.querySelector("details")!;
    expect(texto(detalles.querySelector("summary"))).toBe("Ver los datos");
    expect(m.contenedor.querySelector("table")).toBeNull();
    await alternar(detalles, true);
    const tabla = m.contenedor.querySelector("table")!;
    expect(texto(tabla.querySelector("caption"))).toBe("Valor frente al costo");
    expect([...tabla.querySelectorAll("thead th")].map(texto)).toEqual(["Día", "Valor", "Costo"]);
    expect(tabla.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(texto(tabla.querySelector("tbody tr"))).toBe("día 2027-03-02 $4701 $4517");
    await alternar(detalles, false);
    expect(m.contenedor.querySelector("table")).toBeNull();
  });

  it("la tabla de una gráfica con bandas lleva sus rangos; un dato vacío se escribe «—»", async () => {
    await m.pintar(createElement(GraficaTiempo, base({
      series: [{ id: "mediana", nombre: "Mediana", tono: "neutro", valores: [null, 4588, 4637, 4699, 4711] }],
      bandas: [{ id: "p5", nombre: "P5–P95", tono: "neutro", intensidad: "suave", bajo: [null, 4588, 4391, 4207, 4103], alto: [null, 4588, 4877, 5113, 5227] }],
    })));
    await alternar(m.contenedor.querySelector("details")!, true);
    const filas = [...m.contenedor.querySelectorAll("tbody tr")].map(texto);
    expect(filas[0]).toBe("día 2027-03-01 — —");
    expect(filas[3]).toBe("día 2027-03-04 $4699 $4207 – $5113");
  });
});
