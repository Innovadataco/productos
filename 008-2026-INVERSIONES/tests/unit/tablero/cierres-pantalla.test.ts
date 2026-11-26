// @vitest-environment jsdom
// Regresión «nunca un precio viejo como de hoy» (frente tablero-cierres). Datos inventados:
//   FICT1 · ilíquida: su último cierre (verificado) es del 29-oct-2027, tres semanas antes que los demás.
//   FICT2 · cerró ayer (19-nov-2027) y la rueda anterior (18-nov-2027).
//   FICT9 · incompleta (ventas que sus lotes no cubren): fuera de la tabla y de los totales.
// La pantalla se arma por el camino real (resumen → aVista → <Tablero>, render del servidor) y se lee
// como la lee una persona: por rol y nombre (banner, región «Qué movió…», fila de la especie, h1).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EntradaEspecie } from "@/tablero/calculo";
import type { Resumen } from "@/tablero/datos";
import { aVista } from "@/app/tablero/serializar";
import { Tablero } from "@/app/tablero/Tablero";
import { D, dia, especie, punto, resumenDe } from "./ficticio";

const FICT1 = especie({
  nemotecnico: "FICT1", cantidad: 10n, costoVivo: D(1000),
  cierre: { precio: D(120), fecha: dia("2027-10-29"), verificado: true },
  serie: [punto("2027-10-28", 110), punto("2027-10-29", 120)],
});
const FICT2 = especie({
  nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500),
  cierre: { precio: D(110), fecha: dia("2027-11-19"), verificado: false },
  serie: [punto("2027-11-18", 100), punto("2027-11-19", 110)],
});
const hoy = (precio: number, verificado = false) => ({ precio: D(precio), fecha: dia("2027-11-19"), verificado });
const SIN_PRECIO = especie({ nemotecnico: "FICT3", cantidad: 5n, costoVivo: D(500) });

type Pantalla = HTMLElement;

function pantalla(r: Resumen): Pantalla {
  const raiz = document.createElement("div");
  raiz.innerHTML = renderToStaticMarkup(createElement(Tablero, { vista: aVista(r) }));
  return raiz;
}
const de = (entradas: readonly EntradaEspecie[], incompletas: readonly string[] = []) => pantalla(resumenDe(entradas, { incompletas }));

/** Texto que oye un lector de pantalla: sin lo marcado aria-hidden, con los espacios normalizados. */
function texto(el: Element | null | undefined): string {
  if (!el) return "";
  const copia = el.cloneNode(true) as Element;
  copia.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove());
  return (copia.textContent ?? "").replace(/\s+/g, " ").trim();
}
/** Una región (section con aria-labelledby) por su nombre accesible, o por el comienzo del nombre. */
function region(p: Pantalla, nombre: string | RegExp): Element | undefined {
  return [...p.querySelectorAll("section[aria-labelledby]")].find((s) => {
    const titulo = texto(p.querySelector(`[id="${s.getAttribute("aria-labelledby") ?? ""}"]`));
    return typeof nombre === "string" ? titulo === nombre : nombre.test(titulo);
  });
}
/** La fila de la tabla cuya especie (el botón de la primera celda) es `nemo`. */
const filaDe = (p: Pantalla, nemo: string) => [...p.querySelectorAll("tbody tr")].find((tr) => [...tr.querySelectorAll("button")].some((b) => b.textContent === nemo));
const fila = (p: Pantalla, nemo: string) => texto(filaDe(p, nemo));
const cabecera = (p: Pantalla) => texto(p.querySelector("header")); // el banner de la página
const avisos = (p: Pantalla) => texto(region(p, /^¿Gano\?/));
const queMovio = (p: Pantalla) => texto(region(p, "Qué movió su portafolio"));
const titular = (p: Pantalla) => texto(p.querySelector("h1"));
/** La atenuación del «¿Gano?» es parte del requisito (titular condicionado): se mira su clase. */
const claseGano = (p: Pantalla) => p.querySelector("h1 em")?.className;

describe("una especie ilíquida con el cierre de hace tres semanas", () => {
  const html = de([FICT1, FICT2]);

  it("su fila dice la fecha de su precio, aunque esté verificado, y se marca como aviso", () => {
    expect(fila(html, "FICT1")).toContain("precio del 29-oct-2027 · verificado A&V");
    // La marca visual de «atrasado» es el requisito («se marca visiblemente»): se mira la clase del chip.
    expect(filaDe(html, "FICT1")?.querySelector(".chip")?.classList.contains("aviso")).toBe(true);
  });

  it("la cabecera no dice un solo cierre: avisa que hay precios de fechas distintas", () => {
    expect(cabecera(html)).toContain("Cierres de fechas distintas: del 29-oct-2027 al 19-nov-2027");
  });

  it("un aviso nombra la especie atrasada, su fecha, y que entra en los totales con ese precio", () => {
    expect(avisos(html)).toContain("Con precio de otra fecha (entra en los totales con su último cierre): FICT1, precio del 29-oct-2027.");
  });

  it("«Qué movió» no mezcla periodos: solo FICT2 (18 → 19-nov), sobre su cantidad actual, y dice cuántas omitió", () => {
    const bloque = queMovio(html);
    expect(bloque).toContain("Del 18-nov-2027 al 19-nov-2027 · sobre su cantidad actual");
    expect(bloque).not.toContain("FICT1");
    expect(bloque).toContain("Neto +$ 50"); // (110 − 100) × 5; antes sumaba además (120 − 110) × 10 de octubre
    expect(bloque).toContain("Se omite 1 especie: no tiene cierre en las dos ruedas.");
  });

  it("los aportes de «Qué movió» son una lista: el lector anuncia cuántos hay (cada uno con la procedencia de su cierre)", () => {
    const lista = region(html, "Qué movió su portafolio")?.querySelector('[role="list"]');
    // Desde el frente fecha-hora-datos cada tarjeta dice además el cierre de la referencia; aquí la lectura no trae
    // cuándo se trajo ni la fuente, y la pantalla lo dice en vez de inventarlos.
    expect([...(lista?.querySelectorAll('[role="listitem"]') ?? [])].map(texto)).toEqual([
      expect.stringMatching(/^FICT2\s*\+10,0 %\s*\+\$ 50\s*fuente sin dato · sin la hora en que se trajo Fuente: fuente sin dato\. Retraso conocido: sin dato de esta fuente\. Sin la hora en que se trajo\.$/),
    ]);
  });

  it("el titular se condiciona: el total lleva un precio de otra fecha", () => {
    expect(titular(html)).toMatch(/^¿Gano\? Sí, con precios de fechas distintas\. \+\$ 250/);
    expect(claseGano(html)).toBe("muted");
  });
});

describe("cada fila muestra siempre la fecha de su cierre", () => {
  const html = de([
    especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: hoy(110) }),
    especie({ nemotecnico: "FICT4", cantidad: 5n, costoVivo: D(500), cierre: hoy(110, true) }),
  ]);

  it("verificado y sin verificar, los dos con su fecha", () => {
    expect(fila(html, "FICT4")).toContain("verificado A&V · 19-nov-2027");
    expect(fila(html, "FICT2")).toContain("sin verificar · 19-nov-2027");
  });

  it("todas del mismo día: la cabecera dice un solo cierre y no hay aviso de fechas", () => {
    expect(cabecera(html)).toContain("Cierre 19-nov-2027 ·");
    expect(cabecera(html)).not.toContain("fechas distintas");
    expect(avisos(html)).not.toContain("otra fecha");
  });

  it("sin cierre, la fila lo dice (no «sin verificar · sin dato»)", () => {
    const sin = de([SIN_PRECIO, especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: hoy(110) })]);
    expect(fila(sin, "FICT3")).toContain("sin cierre");
    expect(fila(sin, "FICT3")).not.toContain("sin verificar");
  });

  it("sin ningún cierre vivo, la cabecera dice «Cierre sin dato»", () => {
    expect(cabecera(de([SIN_PRECIO]))).toContain("Cierre sin dato");
  });
});

describe("el titular con datos parciales", () => {
  const completa = especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(500), cierre: hoy(110) });

  it("con una especie incompleta fuera del total: «con datos parciales»", () => {
    const html = de([completa], ["FICT9"]);
    expect(titular(html)).toMatch(/^¿Gano\? Sí, con datos parciales\. /);
    expect(claseGano(html)).toBe("muted");
  });

  it("con una especie viva sin precio: «con datos parciales»", () => {
    expect(titular(de([completa, SIN_PRECIO]))).toMatch(/^¿Gano\? Sí, con datos parciales\. /);
  });

  it("con algo fuera del total y además una atrasada, manda «con datos parciales»", () => {
    expect(titular(de([FICT1, FICT2], ["FICT9"]))).toMatch(/^¿Gano\? Sí, con datos parciales\. /);
  });

  it("en pérdida también se condiciona", () => {
    const perdida = especie({ nemotecnico: "FICT2", cantidad: 5n, costoVivo: D(900), cierre: hoy(110) });
    expect(titular(de([perdida], ["FICT9"]))).toMatch(/^¿Gano\? Por ahora, no, con datos parciales\. −\$ 350/);
  });

  it("con todos los datos completos y del mismo día, afirma a secas", () => {
    const html = de([completa]);
    expect(titular(html)).toMatch(/^¿Gano\? Sí\. \+\$ 50/);
    expect(claseGano(html)).toBe("gain");
  });
});

describe("«Qué movió» cuando no se puede comparar todo", () => {
  const mov = (entradas: readonly EntradaEspecie[], noHabiles: ReadonlySet<string> = new Set()) => queMovio(pantalla(resumenDe(entradas, { noHabiles })));
  const conSerie = (nemo: string, serie: readonly (readonly [string, number])[]) => {
    const puntos = serie.map(([f, p]) => punto(f, p));
    return especie({ nemotecnico: nemo, cantidad: 5n, costoVivo: D(500), serie: puntos, cierre: { ...puntos.at(-1)!, verificado: false } });
  };

  it("si no entra ninguna, el neto es «—» (no «$ 0», que diría que nada se movió) y se dicen cuántas", () => {
    const bloque = mov([conSerie("FICT2", [["2027-11-19", 110]]), conSerie("FICT4", [["2027-11-17", 1], ["2027-11-19", 2]])]);
    expect(bloque).toContain("Neto —");
    expect(bloque).toContain("Se omiten 2 especies: no tienen cierre en las dos ruedas.");
  });

  it("si el cierre más reciente no es día hábil, no se compara y se dice por qué", () => {
    const bloque = mov([conSerie("FICT2", [["2027-01-08", 100], ["2027-01-11", 110]])], new Set(["2027-01-11"]));
    expect(bloque).toContain("El cierre más reciente (11-ene-2027) no es día hábil de la BVC: no se compara.");
    expect(bloque).toContain("Neto —");
    expect(bloque).not.toContain("FICT2");
  });

  it("si el calendario de la BVC no cubre la fecha, no se compara y se dice por qué", () => {
    const html = pantalla(resumenDe([conSerie("FICT2", [["2028-01-10", 100], ["2028-01-11", 110]])], { anios: [2026, 2027] }));
    expect(queMovio(html)).toContain("El calendario de la BVC no cubre la fecha del cierre (11-ene-2028): no se compara.");
    expect(queMovio(html)).toContain("Neto —");
  });

  it("sin ningún cierre vivo: «Sin cierres para comparar.»", () => {
    expect(mov([SIN_PRECIO])).toContain("Sin cierres para comparar.");
  });

  it("con todas en el mismo par de ruedas no hay nota de omitidas", () => {
    const bloque = mov([conSerie("FICT2", [["2027-11-18", 100], ["2027-11-19", 110]]), conSerie("FICT4", [["2027-11-18", 10], ["2027-11-19", 9]])]);
    expect(bloque).toContain("Neto +$ 45"); // +50 − 5
    expect(bloque).not.toContain("Se omit");
  });
});
