/**
 * Movimiento de las gráficas: «reducir movimiento» (se sigue en vivo; en el servidor, false), aparición al entrar en
 * pantalla y una interpolación por cuadros que respeta las dos cosas. Sin «reducir movimiento» ni pestaña visible,
 * o sin requestAnimationFrame, todo salta al valor final.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";
const DURACION_MS = 650;
const UMBRAL_VISIBLE = 0.15;

const hayMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

function suscribir(aviso: () => void): () => void {
  if (!hayMatchMedia()) return () => undefined;
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

const leer = (): boolean => hayMatchMedia() && window.matchMedia(CONSULTA).matches;
const enServidor = (): boolean => false;

export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, leer, enServidor);
}

/** true cuando el elemento entra en pantalla (y se queda en true). Sin IntersectionObserver, de una. */
export function useVisible<T extends Element>(): { readonly ref: (el: T | null) => void; readonly visible: boolean } {
  const [el, setEl] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!el || visible) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setVisible(true);
    }, { threshold: UMBRAL_VISIBLE });
    observador.observe(el);
    return () => observador.disconnect();
  }, [el, visible]);
  return { ref: setEl, visible };
}

/** true después de hidratar (en el servidor y en el primer cuadro, false). */
export function useHidratado(): boolean {
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return listo;
}

const suave = (k: number): number => 1 - (1 - k) ** 3;

/** Va del valor mostrado al objetivo en `ms`, por cuadros. Si el largo cambia, salta. */
export function useTransicion(objetivo: readonly number[], ms = DURACION_MS): readonly number[] {
  const reducido = useMovimientoReducido();
  const [actual, setActual] = useState<readonly number[]>(objetivo);
  const mostrado = useRef<readonly number[]>(objetivo);
  // La clave lleva los números exactos (String ↔ Number es ida y vuelta sin pérdida): el efecto no lee props.
  const clave = objetivo.join("|");
  useEffect(() => {
    const hasta = clave === "" ? [] : clave.split("|").map(Number);
    const desde = mostrado.current;
    const salta = reducido || document.hidden || desde.length !== hasta.length || typeof requestAnimationFrame !== "function";
    if (salta || desde.every((v, i) => v === hasta[i])) {
      mostrado.current = hasta;
      setActual(hasta);
      return undefined;
    }
    let cuadro = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      const v = k >= 1 ? hasta : desde.map((a, i) => a + (hasta[i]! - a) * suave(k));
      mostrado.current = v;
      setActual(v);
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [clave, reducido, ms]);
  if (reducido || actual.length !== objetivo.length) return objetivo;
  return actual;
}
