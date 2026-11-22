/**
 * La cola de pedidos del simulador en el navegador (frente proyecciones-pantalla). El servidor admite una proyección en
 * vuelo por usuario, así que aquí:
 * - se espera ESPERA_MS sin cambios antes de pedir (debounce): mover un deslizador no dispara un pedido por paso;
 * - nunca hay más de un pedido en vuelo; lo que se mueve mientras, se pide al terminar, y solo lo último;
 * - una respuesta que ya no es la de lo último que se movió no se entrega (no pisa ni hace parpadear);
 * - «ocupado» (429) reintenta lo mismo después de Retry-After, hasta MAX_REINTENTOS veces;
 * - un error o unos parámetros rechazados se avisan y dejan pedir de nuevo (lo último que se mostró se queda).
 * Sin React ni red: `enviar` lo pone quien la usa (src/app/proyecciones/pedido.ts).
 */
import type { Controles } from "./opciones";
import type { VistaProyeccion } from "./vista";

export const ESPERA_MS = 350;
const MAX_REINTENTOS = 3;
const MS_POR_S = 1000;

export type Respuesta =
  | { readonly tipo: "OK"; readonly vista: VistaProyeccion }
  | { readonly tipo: "OCUPADO"; readonly reintentarEnS: number }
  | { readonly tipo: "PARAMETROS" }
  | { readonly tipo: "ERROR" };

export type Fallo = "OCUPADO" | "PARAMETROS" | "ERROR";

export interface Avisos {
  readonly calculando: (si: boolean) => void;
  readonly resultado: (vista: VistaProyeccion) => void;
  readonly fallo: (tipo: Fallo) => void;
}

export interface Cola {
  readonly pedir: (controles: Controles) => void;
  /** Al desmontar: suelta los temporizadores y no entrega nada más. */
  readonly cancelar: () => void;
}

export function crearCola({ enviar, al }: { readonly enviar: (c: Controles) => Promise<Respuesta>; readonly al: Avisos }): Cola {
  let viva = true;
  let espera: ReturnType<typeof setTimeout> | null = null;
  let enVuelo = false;
  /** Lo último que se movió y todavía no se pidió. */
  let pendiente: Controles | null = null;
  let reintentos = 0;

  const limpiar = () => {
    if (espera !== null) clearTimeout(espera);
    espera = null;
  };

  const terminar = (r: Respuesta) => {
    if (r.tipo === "OK") al.resultado(r.vista);
    else al.fallo(r.tipo);
    al.calculando(false);
  };

  const lanzar = (c: Controles) => {
    enVuelo = true;
    enviar(c)
      .catch((): Respuesta => ({ tipo: "ERROR" }))
      .then((r) => {
        enVuelo = false;
        if (!viva) return;
        if (pendiente !== null) {
          // Ya se movió otra cosa: esta respuesta es vieja. Se pide lo último.
          const siguiente = pendiente;
          pendiente = null;
          reintentos = 0;
          lanzar(siguiente);
          return;
        }
        if (r.tipo === "OCUPADO" && reintentos < MAX_REINTENTOS) {
          reintentos += 1;
          espera = setTimeout(() => { espera = null; if (pendiente === null) lanzar(c); }, Math.max(1, r.reintentarEnS) * MS_POR_S);
          return;
        }
        reintentos = 0;
        terminar(r);
      });
  };

  return {
    pedir(c) {
      if (!viva) return;
      limpiar();
      al.calculando(true);
      espera = setTimeout(() => {
        espera = null;
        reintentos = 0;
        if (enVuelo) pendiente = c;
        else lanzar(c);
      }, ESPERA_MS);
    },
    cancelar() {
      viva = false;
      limpiar();
    },
  };
}
