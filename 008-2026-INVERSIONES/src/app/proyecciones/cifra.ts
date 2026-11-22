/**
 * Las cifras de los indicadores que cuentan hacia arriba (frente proyecciones-pantalla): al cargar, desde 0 (ocultas
 * hasta su primer cuadro, como el tablero: no se ve la final y luego el 0); en un recálculo, desde la cifra que se ve.
 * Con «reducir movimiento», pestaña oculta o sin requestAnimationFrame, la final de una. En el servidor, la final (en
 * fase «espera»: el CSS la oculta solo si el navegador va a animar).
 */
import { useEffect, useRef, useState } from "react";
import { useMovimientoReducido } from "@/app/_graficas";

export type Fase = "espera" | "anima" | "fin";
export interface EstadoCifra { readonly valor: number | null; readonly fase: Fase }

const DURACION_MS = 1200;
/** La primera cuenta espera un poco: la página termina de entrar. */
const ESPERA_MS = 150;
const salida = (k: number): number => 1 - (1 - k) ** 4;

export function useCifra(fin: number | null): EstadoCifra {
  const reducido = useMovimientoReducido();
  const [estado, setEstado] = useState<EstadoCifra>({ valor: fin, fase: "espera" });
  /** Lo que se ve; null antes de la primera cuenta (que va desde 0). */
  const mostrado = useRef<number | null>(null);
  useEffect(() => {
    if (fin === null) {
      setEstado({ valor: null, fase: "fin" });
      return undefined;
    }
    const primera = mostrado.current === null;
    const desde = mostrado.current ?? 0;
    if (reducido || document.hidden || typeof requestAnimationFrame !== "function" || desde === fin) {
      mostrado.current = fin;
      setEstado({ valor: fin, fase: "fin" });
      return undefined;
    }
    let cuadro = 0;
    const t0 = performance.now() + (primera ? ESPERA_MS : 0);
    const paso = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / DURACION_MS));
      const v = k >= 1 ? fin : desde + (fin - desde) * salida(k);
      mostrado.current = v;
      setEstado({ valor: v, fase: k < 1 ? "anima" : "fin" });
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [fin, reducido]);
  return estado;
}
