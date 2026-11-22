// @vitest-environment jsdom
// El simulador en el navegador (frente proyecciones-pantalla): controles con etiqueta que se usan con teclado y con el
// dedo, el cálculo en el servidor con debounce (un pedido a la vez), el resultado anterior se queda mientras calcula
// (aria-busy, sin parpadeo), los indicadores y el abanico cambian con la respuesta y el cambio se anuncia. Los valores
// no se guardan (sin localStorage ni la URL). Con «reducir movimiento» (sin animación) y temporizadores falsos. Inventado.
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosProyecciones } from "@/app/proyecciones/datos";
import { Simulador } from "@/app/proyecciones/Simulador";
import { aVistaProyeccion, type VistaProyeccion } from "@/app/proyecciones/vista";
import { AVISO } from "@/proyecciones/tipos";
import { montar, movimiento, texto, type Montaje } from "../graficas/dom";
import { PARAMETROS, puntosFicticios, resultadoFicticio } from "./ficticio";

const INICIAL = aVistaProyeccion(resultadoFicticio({ parametros: { ...PARAMETROS, horizonteMeses: 60 } }));
const DIEZ = aVistaProyeccion(resultadoFicticio({
  parametros: { ...PARAMETROS, horizonteMeses: 120 }, puntos: puntosFicticios(120, 46137.41, 263.11, 131.71), probabilidadBajoAportado: 0.0713, caidaMaximaMediana: 0.1371,
}));
const DATOS: DatosProyecciones = { hoy: "2027-03-17", historia: [{ dia: "2027-01-29", valor: 44_701.13 }, { dia: "2027-02-26", valor: 45_793.29 }], inicial: INICIAL, estado: "LISTO" };

let m: Montaje;
let respuestas: ((r: Response) => void)[];
const fetchFalso = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>((r) => respuestas.push(r)));

beforeEach(() => {
  vi.useFakeTimers();
  movimiento(true);
  respuestas = [];
  fetchFalso.mockClear();
  vi.stubGlobal("fetch", fetchFalso);
  m = montar();
});
afterEach(() => {
  m.desmontar();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pintar = (datos: DatosProyecciones = DATOS) => m.pintar(createElement(Simulador, { datos }));
const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const responder = async (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) => {
  await act(async () => { respuestas.shift()!(new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json", ...cabeceras } })); });
  await avanzar(0);
};
const boton = (t: string) => [...m.contenedor.querySelectorAll<HTMLButtonElement>("button")].find((b) => texto(b) === t)!;
const control = (etiqueta: string) => {
  const label = [...m.contenedor.querySelectorAll("label")].find((l) => texto(l).startsWith(etiqueta))!;
  return document.getElementById(label.htmlFor) as HTMLInputElement;
};
const resultado = () => m.contenedor.querySelector<HTMLElement>("[aria-busy]")!;
const indicador = (k: number) => texto(m.contenedor.querySelectorAll(".proy-indicador")[k]!.querySelector(".sr"));
const estado = () => texto(m.contenedor.querySelector("[role=status]"));
const banda = () => m.contenedor.querySelector("path.g-banda-suave")!.getAttribute("d");

/** Cambia un input como lo hace React con el usuario (setter nativo + evento). */
async function escribir(el: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Simulador · pantalla", () => {
  it("el aviso fijo, el título, los indicadores del resultado inicial y el abanico con «Hoy»", async () => {
    await pintar();
    expect(texto(m.contenedor.querySelector("h1"))).toBe("Proyecciones");
    expect(texto(m.contenedor.querySelector(".proy-aviso"))).toContain(AVISO);
    expect(INICIAL.final.p50).toBe(58820);
    expect(indicador(0)).toBe("Valor mediano al final: $ 58.820");
    expect(texto(m.contenedor.querySelectorAll(".proy-indicador")[0]!)).toContain("P5–P95");
    expect(indicador(2)).toBe("Probabilidad de terminar por debajo de lo aportado: 13,7 %");
    expect(indicador(3)).toBe("Peor caída mediana: −9,2 %");
    expect(texto(m.contenedor.querySelector(".g-corte"))).toBe("Hoy");
    expect(m.contenedor.querySelectorAll("path.g-banda")).toHaveLength(2);
    expect(m.contenedor.querySelectorAll("defs linearGradient")).toHaveLength(2);
    expect(resultado().getAttribute("aria-busy")).toBe("false");
  });

  it("los supuestos y los avisos del motor en texto llano", async () => {
    await pintar();
    const supuestos = m.contenedor.querySelector('section[aria-labelledby="t-supuestos"]')!;
    expect([...supuestos.querySelectorAll(".proy-supuestos li")].map(texto)).toEqual(INICIAL.textos);
    expect([...supuestos.querySelectorAll(".proy-avisos li")].map(texto)).toEqual(INICIAL.avisos.map((a) => a.texto));
    expect(texto(supuestos)).toContain("bootstrap-circular-v1");
  });

  it("cada control tiene su etiqueta; el horizonte fino dice años y meses", async () => {
    await pintar();
    expect(control("Ajuste fino del horizonte").type).toBe("range");
    expect(control("Ajuste fino del horizonte").getAttribute("aria-valuetext")).toBe("5 años");
    expect(control("Aporte periódico").type).toBe("number");
    expect(control("Reinvertir los dividendos").getAttribute("role")).toBe("switch");
    // En palabras, como la cifra a la vista (hallazgo BAJO de a11y-architect).
    expect(control("Caída inicial").getAttribute("aria-valuetext")).toBe("sin caída");
    expect(m.contenedor.querySelector("[role=group][aria-label='Horizonte']")).not.toBeNull();
    expect(m.contenedor.querySelector("[role=group][aria-label='Frecuencia del aporte']")).not.toBeNull();
    expect(boton("5 años").getAttribute("aria-pressed")).toBe("true");
  });

  it("al mover un control espera 350 ms y pide al servidor los cinco controles; el resultado anterior se queda mientras calcula", async () => {
    await pintar();
    const antes = banda();
    await act(async () => boton("10 años").click());
    expect(resultado().getAttribute("aria-busy")).toBe("true");
    expect(banda()).toBe(antes);
    await avanzar(349);
    expect(fetchFalso).not.toHaveBeenCalled();
    await avanzar(1);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(url).toBe("/api/proyecciones");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(String(init.body))).toEqual({ horizonteMeses: 120, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0 });
    await responder({ vista: DIEZ });
    expect(resultado().getAttribute("aria-busy")).toBe("false");
    expect(banda()).not.toBe(antes);
    expect(indicador(2)).toBe("Probabilidad de terminar por debajo de lo aportado: 7,1 %");
    // El anuncio espera 800 ms sin otro resultado: el lector oye solo el último (hallazgo MEDIO de a11y-architect).
    expect(estado()).toBe("");
    await avanzar(800);
    expect(estado()).toContain("Proyección a 10 años");
    expect(estado()).toContain("7,1 %");
    // Sin jerga: el rango se dice en palabras.
    expect(estado()).toContain("el 90 % de las trayectorias");
    expect(estado()).not.toContain("P5");
  });

  it("dos resultados seguidos: se anuncia solo el último", async () => {
    await pintar();
    await act(async () => boton("10 años").click());
    await avanzar(350);
    await responder({ vista: DIEZ });
    await avanzar(300);
    await act(async () => boton("5 años").click());
    await avanzar(350);
    await responder({ vista: INICIAL });
    await avanzar(800);
    expect(estado()).toContain("Proyección a 5 años");
  });

  it("un cálculo que tarda más de 1,5 s se anuncia («Calculando…»); el aviso de fallo va fuera de la región ocupada", async () => {
    await pintar();
    await act(async () => boton("1 año").click());
    await avanzar(350);
    await avanzar(1_499);
    expect(estado()).toBe("");
    await avanzar(1);
    expect(estado()).toBe("Calculando…");
    await responder({ error: "x" }, 500);
    expect(m.contenedor.querySelector("[role=alert]")).not.toBeNull();
    expect(m.contenedor.querySelector("[aria-busy] [role=alert]")).toBeNull();
  });

  it("los deslizadores llevan el tramo recorrido para pintar la pista (WebKit no tiene «progreso»)", async () => {
    await pintar();
    expect(control("Ajuste fino del horizonte").style.getPropertyValue("--relleno")).toBe("49.6%");
    expect(control("Caída inicial").style.getPropertyValue("--relleno")).toBe("0%");
  });

  it("el aporte, la frecuencia, la reinversión y la caída viajan en el pedido", async () => {
    await pintar();
    await escribir(control("Aporte periódico"), "413.71");
    await act(async () => boton("Trimestral").click());
    await act(async () => control("Reinvertir los dividendos").click());
    await escribir(control("Caída inicial"), "13");
    await escribir(control("Ajuste fino del horizonte"), "37");
    await avanzar(350);
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1].body))).toEqual({ horizonteMeses: 37, aportePeriodico: 413.71, frecuenciaAporte: "TRIMESTRAL", reinvertirDividendos: false, caidaInicialPct: 13 });
    expect(control("Caída inicial").getAttribute("aria-valuetext")).toBe("caída de 13 %");
    expect(control("Ajuste fino del horizonte").getAttribute("aria-valuetext")).toBe("3 años y 1 mes");
  });

  it("un aporte vacío o negativo cuenta como 0; uno enorme se recorta al tope", async () => {
    await pintar();
    const ayuda = () => texto(document.getElementById(control("Aporte periódico").getAttribute("aria-describedby")!.split(" ").at(-1)!));
    await escribir(control("Aporte periódico"), "-7");
    await avanzar(350);
    expect(JSON.parse(String(fetchFalso.mock.calls[0]![1].body)).aportePeriodico).toBe(0);
    // Lo que se corrige se dice (hallazgo BAJO de a11y-architect, WCAG 3.3.1).
    expect(ayuda()).toBe("Ese valor no sirve como aporte: se calcula sin aportes.");
    await responder({ vista: INICIAL });
    await escribir(control("Aporte periódico"), "9e15");
    await avanzar(350);
    expect(JSON.parse(String(fetchFalso.mock.calls[1]![1].body)).aportePeriodico).toBe(1e12);
    expect(ayuda()).toBe("Pasa del tope: se calcula con $ 1.000.000.000.000.");
    await escribir(control("Aporte periódico"), "413.71");
    expect(ayuda()).toBe("");
  });

  it("un error conserva el resultado anterior y lo dice con un mensaje genérico", async () => {
    await pintar();
    const antes = banda();
    await act(async () => boton("1 año").click());
    await avanzar(350);
    await responder({ error: "No se pudo calcular la proyección. Intente de nuevo." }, 500);
    expect(banda()).toBe(antes);
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toBe("No se pudo calcular la proyección. Intente de nuevo moviendo un control.");
    expect(resultado().getAttribute("aria-busy")).toBe("false");
  });

  it("ocupado (429) reintenta solo después de Retry-After", async () => {
    await pintar();
    await act(async () => boton("1 año").click());
    await avanzar(350);
    await responder({ error: "Hay un cálculo en curso." }, 429, { "retry-after": "2" });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await avanzar(2_000);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("«Valores iniciales» vuelve a los controles de arranque y recalcula", async () => {
    await pintar();
    await act(async () => boton("10 años").click());
    await avanzar(350);
    await responder({ vista: DIEZ });
    await act(async () => boton("Valores iniciales").click());
    expect(boton("5 años").getAttribute("aria-pressed")).toBe("true");
    await avanzar(350);
    expect(JSON.parse(String(fetchFalso.mock.calls[1]![1].body)).horizonteMeses).toBe(60);
  });

  it("sin resultado inicial (turno ocupado) pide solo al montar y muestra «Calculando…»", async () => {
    await pintar({ ...DATOS, inicial: null, estado: "OCUPADO" });
    expect(resultado().getAttribute("aria-busy")).toBe("true");
    expect(texto(m.contenedor.querySelector(".proy-calculando"))).toBe("Calculando…");
    await avanzar(350);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await responder({ vista: INICIAL });
    expect(indicador(2)).toBe("Probabilidad de terminar por debajo de lo aportado: 13,7 %");
  });

  it("si el cálculo inicial falló, lo dice y espera a que se mueva un control", async () => {
    await pintar({ ...DATOS, inicial: null, estado: "FALLO" });
    expect(texto(m.contenedor.querySelector("[role=alert]"))).toBe("No se pudo calcular la proyección. Intente de nuevo moviendo un control.");
    await avanzar(1_000);
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(indicador(0)).toBe("Valor mediano al final: —");
  });

  it("no guarda nada: ni localStorage ni la URL", async () => {
    const guardar = vi.spyOn(Storage.prototype, "setItem");
    const historial = vi.spyOn(window.history, "replaceState");
    await pintar();
    await act(async () => boton("3 años").click());
    await avanzar(350);
    expect(guardar).not.toHaveBeenCalled();
    expect(historial).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});
