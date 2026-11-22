// Ayudas de las pruebas DOM del módulo de gráficas (frente graficas-tablero). No es una prueba.
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Montaje {
  readonly contenedor: HTMLDivElement;
  pintar(el: ReactElement): Promise<void>;
  desmontar(): void;
}

export function montar(): Montaje {
  const contenedor = document.createElement("div");
  document.body.append(contenedor);
  let raiz: Root | null = createRoot(contenedor);
  return {
    contenedor,
    pintar: async (el) => { await act(async () => raiz!.render(el)); },
    desmontar: () => {
      if (raiz) act(() => raiz!.unmount());
      raiz = null;
      contenedor.remove();
    },
  };
}

/** Oyentes de «reducir movimiento» para poder cambiarlo en medio de una prueba. */
const oyentes = new Set<() => void>();
let reducir = true;

/** matchMedia falso: «reducir movimiento» según `reducido`; cualquier otra consulta, falsa. */
export function movimiento(reducido: boolean): void {
  reducir = reducido;
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() { return q.includes("reduce") ? reducir : false; },
    addEventListener: (_: string, f: () => void) => oyentes.add(f),
    removeEventListener: (_: string, f: () => void) => oyentes.delete(f),
  }));
}

export async function cambiarMovimiento(reducido: boolean): Promise<void> {
  reducir = reducido;
  await act(async () => { oyentes.forEach((f) => f()); });
}

/** Cuadros de animación a mano: `avanzar(ms)` corre los pendientes con el reloj adelantado. */
export function reloj(): { avanzar(ms: number): Promise<void>; pendientes(): number } {
  let ahora = 1000;
  let cola: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cola.push(cb); return cola.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { cola = []; });
  vi.spyOn(performance, "now").mockImplementation(() => ahora);
  return {
    avanzar: async (ms) => {
      ahora += ms;
      const lote = cola;
      cola = [];
      await act(async () => { lote.forEach((cb) => cb(ahora)); });
    },
    pendientes: () => cola.length,
  };
}

/** IntersectionObserver falso: `entrar()` avisa a todos que su elemento ya se ve. */
export function observador(): { entrar(): Promise<void>; desconectados(): number } {
  const vivos: { cb: IntersectionObserverCallback; el: Element[] }[] = [];
  let desconectados = 0;
  class Falso {
    private readonly registro: { cb: IntersectionObserverCallback; el: Element[] };
    constructor(cb: IntersectionObserverCallback) { this.registro = { cb, el: [] }; vivos.push(this.registro); }
    observe(el: Element) { this.registro.el.push(el); }
    disconnect() { desconectados += 1; }
    unobserve() { /* no hace falta */ }
    takeRecords() { return []; }
  }
  vi.stubGlobal("IntersectionObserver", Falso);
  return {
    entrar: async () => {
      await act(async () => {
        vivos.forEach((v) => v.cb(v.el.map((target) => ({ isIntersecting: true, target }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver));
      });
    },
    desconectados: () => desconectados,
  };
}

/** Rectángulo del elemento (jsdom no hace diseño). */
export function rectangulo(el: Element, ancho: number, izquierda = 0): void {
  el.getBoundingClientRect = () => ({ left: izquierda, top: 0, width: ancho, height: 220, right: izquierda + ancho, bottom: 220, x: izquierda, y: 0, toJSON: () => ({}) });
}

/** React arma enter/leave con pointerover/pointerout: «entrar» y «salir» se disparan así. */
export async function puntero(el: Element, tipo: "pointermove" | "pointerdown" | "entrar" | "salir", clientX = 0, pointerType = "mouse"): Promise<void> {
  const nombre = tipo === "entrar" ? "pointerover" : tipo === "salir" ? "pointerout" : tipo;
  const relatedTarget = tipo === "entrar" || tipo === "salir" ? document.body : null;
  await act(async () => {
    el.dispatchEvent(new PointerEvent(nombre, { bubbles: true, clientX, pointerType, relatedTarget }));
  });
}

export async function tecla(el: Element, key: string): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  });
}

export async function enfocar(el: HTMLElement): Promise<void> {
  await act(async () => { el.focus(); });
}

export async function desenfocar(el: HTMLElement): Promise<void> {
  await act(async () => { el.blur(); });
}

export const texto = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Abre o cierra un <details> como lo hace el navegador (cambia `open` y avisa con «toggle»). */
export async function alternar(detalles: HTMLDetailsElement, abierto: boolean): Promise<void> {
  await act(async () => {
    detalles.open = abierto;
    detalles.dispatchEvent(new Event("toggle"));
  });
}
