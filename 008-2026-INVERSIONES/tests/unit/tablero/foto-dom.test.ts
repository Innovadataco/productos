// @vitest-environment jsdom
// «Cómo está repartido» (frente graficas-tablero): composición y rentabilidad por especie al cierre de referencia.
// Cada cifra lleva a su origen: el clic abre el detalle de la especie y, al cerrarlo, el foco vuelve a donde estaba.
// Datos inventados.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { montar, movimiento, tecla, texto, type Montaje } from "../graficas/dom";
import { D, dia, especie, resumenDe } from "./ficticio";
import { nueveEspecies } from "./ficticio-graficas";

const cierre = (precio: string) => ({ precio: D(precio), fecha: dia("2027-03-31"), verificado: false, traidoEn: new Date("2027-03-31T23:04:00Z"), fuente: "yahoo" });
const tres = aVista(resumenDe([
  especie({ nemotecnico: "FICTA", cantidad: 13n, costoVivo: D(4613), cierre: cierre("317.41") }),
  especie({ nemotecnico: "FICTB", cantidad: 7n, costoVivo: D(7919), cierre: cierre("1211.09") }),
  especie({ nemotecnico: "FICTC", cantidad: 5n, costoVivo: D(1237) }),
]));

let m: Montaje;
beforeEach(() => {
  movimiento(true);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.unstubAllGlobals();
});

const seccion = () => m.contenedor.querySelector<HTMLElement>('section[aria-labelledby="t-foto"]')!;
const barras = () => [...seccion().querySelectorAll<HTMLButtonElement>("button.g-barra")];
const leyenda = () => [...seccion().querySelectorAll<HTMLElement>(".g-leyenda-dona li")];
const detalle = (nemo: string) => m.contenedor.querySelector(`aside[aria-label="Detalle de ${nemo}"]`);
const celdaPct = (nemo: string) => {
  const fila = [...m.contenedor.querySelectorAll("tbody tr")].find((tr) => texto(tr.querySelector("button")) === nemo)!;
  return texto(fila.querySelectorAll("td")[7]!);
};

describe("Cómo está repartido", () => {
  it("composición con el valor en acciones al centro y el peso de cada especie; la que no tiene cierre se dice aparte", async () => {
    await m.pintar(createElement(Tablero, { vista: tres }));
    expect(texto(seccion().querySelector("h2"))).toBe("Cómo está repartido");
    expect(texto(seccion().querySelector(".eyebrow"))).toBe("Al cierre del 31-mar-2027");
    expect(texto(seccion().querySelector(".g-centro"))).toBe("Valor en acciones $ 12.604");
    expect(leyenda().map((li) => texto(li).replace(" (ver el detalle)", ""))).toEqual(["FICTB $ 8.478 67,3 %", "FICTA $ 4.126 32,7 %"]);
    expect(texto(seccion())).toContain("Sin cierre (no entra aquí): FICTC");
  });

  it("rentabilidad sin vender de mayor a menor; cada barra dice lo mismo que la columna % de la tabla y su origen", async () => {
    await m.pintar(createElement(Tablero, { vista: tres }));
    expect(barras().map((b) => texto(b.querySelector(".g-barra-nombre")))).toEqual(["FICTB", "FICTA"]);
    for (const b of barras()) {
      const nemo = texto(b.querySelector(".g-barra-nombre"));
      expect(texto(b.querySelector(".g-barra-valor"))).toBe(celdaPct(nemo));
    }
    // La procedencia va en la fila, el detalle y bajo las gráficas: aquí alargaría el nombre del botón (revisión a11y).
    expect(texto(barras()[0]!.querySelector(".g-barra-detalle"))).toBe("costo $ 7.919 · valor $ 8.478 · sin verificar · 31-mar-2027");
  });

  it("el clic en una barra abre el detalle de la especie; Escape lo cierra y devuelve el foco a la barra", async () => {
    await m.pintar(createElement(Tablero, { vista: tres }));
    const b = barras()[1]!;
    await act(async () => b.click());
    expect(detalle("FICTA")).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("FICTA");
    await tecla(detalle("FICTA")!, "Escape");
    expect(detalle("FICTA")).toBeNull();
    expect(document.activeElement).toBe(b);
  });

  it("el clic en la leyenda de la composición también; «Cerrar» devuelve el foco a la leyenda", async () => {
    await m.pintar(createElement(Tablero, { vista: tres }));
    const b = leyenda()[0]!.querySelector("button")!;
    await act(async () => b.click());
    expect(detalle("FICTB")).not.toBeNull();
    await act(async () => [...detalle("FICTB")!.querySelectorAll("button")].find((x) => texto(x) === "Cerrar")!.click());
    expect(document.activeElement).toBe(b);
  });

  it("si el detalle se abrió desde la tabla, al cerrarlo el foco vuelve a la tabla (como antes)", async () => {
    await m.pintar(createElement(Tablero, { vista: tres }));
    const enTabla = [...m.contenedor.querySelectorAll<HTMLButtonElement>("tbody button")].find((x) => texto(x) === "FICTA")!;
    await act(async () => enTabla.click());
    await tecla(detalle("FICTA")!, "Escape");
    expect(document.activeElement).toBe(enTabla);
  });

  it("con 9 especies, 7 y «Otras» (que dice qué incluye y no abre detalle)", async () => {
    await m.pintar(createElement(Tablero, { vista: aVista(resumenDe(nueveEspecies())) }));
    expect(leyenda()).toHaveLength(8);
    const otras = leyenda()[7]!;
    expect(texto(otras)).toMatch(/^Otras \$ [\d.]+ [\d,]+ % Incluye FICT\d, FICT\d$/);
    expect(otras.querySelector("button")).toBeNull();
  });

  it("sin especies con cierre, las dos gráficas lo dicen", async () => {
    await m.pintar(createElement(Tablero, { vista: aVista(resumenDe([especie({ nemotecnico: "FICTC", cantidad: 5n, costoVivo: D(1237) })])) }));
    expect(texto(seccion())).toContain("Sin valores para repartir");
    expect(texto(seccion())).toContain("Sin especies con rentabilidad");
  });
});
