/**
 * La cola de pedidos del simulador en el navegador (frente proyecciones-pantalla). El servidor admite una proyección en
 * vuelo por usuario, así que aquí:
 * - se espera ESPERA_MS sin cambios antes de pedir (debounce): mover un deslizador no dispara un pedido por paso;
 * - nunca hay más de un pedido en vuelo; lo que se mueve mientras, se pide al terminar, y solo lo último;
 * - una respuesta que ya no es la de lo último que se movió (porque hay otro pedido esperando o un debounce corriendo)
 *   no se entrega ni apaga «Calculando…»: no pisa ni hace parpadear;
 * - «ocupado» (429) reintenta lo mismo después de Retry-After, hasta MAX_REINTENTOS veces; un Retry-After largo (el
 *   límite de frecuencia, hasta un minuto) no se espera: se avisa al instante;
 * - un error o unos parámetros rechazados se avisan y dejan pedir de nuevo (lo último que se mostró se queda);
 * - al desmontar (cancelar) se sueltan los temporizadores y se aborta el pedido en vuelo.
 * Sin React ni red: `enviar` lo pone quien la usa (src/app/proyecciones/pedido.ts).
 */
import type { Controles } from "./opciones";
import type { VistaProyeccion } from "./vista";

export const ESPERA_MS = 350;
const MAX_REINTENTOS = 3;
/** Más que esto de Retry-After es el límite de frecuencia: no se reintenta solo. */
const MAX_ESPERA_REINTENTO_S = 5;
const MS_POR_S = 1000;

export type Respuesta =
  | { readonly tipo: "OK"; readonly vista: VistaProyeccion }
  | { readonly tipo: "OCUPADO"; readonly reintentarEnS: number }
  | { readonly tipo: "PARAMETROS" }
  | { readonly tipo: "ERROR" };

export type Fallo = "OCUPADO" | "FRECUENCIA" | "PARAMETROS" | "ERROR";

export interface Avisos {
  readonly calculando: (si: boolean) => void;
  readonly resultado: (vista: VistaProyeccion) => void;
  readonly fallo: (tipo: Fallo) => void;
}

export interface Cola {
  readonly pedir: (controles: Controles) => void;
  /** Al desmontar: suelta los temporizadores, aborta el pedido en vuelo y no entrega nada más. */
  readonly cancelar: () => void;
}

export type Enviar = (c: Controles, senal: AbortSignal) => Promise<Respuesta>;

export function crearCola({ enviar, al }: { readonly enviar: Enviar; readonly al: Avisos }): Cola {
  let viva = true;
  /** El debounce o la espera de un reintento (nunca los dos: un reintento solo se arma sin pedido en vuelo). */
  let espera: ReturnType<typeof setTimeout> | null = null;
  let enVuelo: AbortController | null = null;
  /** Lo último que se movió mientras había un pedido en vuelo. */
  let pendiente: Controles | null = null;
  let reintentos = 0;

  const limpiar = () => {
    if (espera !== null) clearTimeout(espera);
    espera = null;
  };

  const entregar = (r: Respuesta) => {
    try {
      if (r.tipo === "OK") al.resultado(r.vista);
      else if (r.tipo === "OCUPADO") al.fallo(r.reintentarEnS > MAX_ESPERA_REINTENTO_S ? "FRECUENCIA" : "OCUPADO");
      else al.fallo(r.tipo);
    } catch {
      al.fallo("ERROR");
    } finally {
      al.calculando(false);
    }
  };

  const reintentar = (r: Respuesta): boolean => r.tipo === "OCUPADO" && r.reintentarEnS <= MAX_ESPERA_REINTENTO_S && reintentos < MAX_REINTENTOS;

  const alResponder = (c: Controles, r: Respuesta) => {
    enVuelo = null;
    if (!viva) return;
    // Corre el debounce de otro cambio: él pedirá lo último.
    if (espera !== null) return;
    if (pendiente !== null) {
      const siguiente = pendiente;
      pendiente = null;
      reintentos = 0;
      lanzar(siguiente);
      return;
    }
    if (reintentar(r)) {
      reintentos += 1;
      espera = setTimeout(() => { espera = null; lanzar(c); }, Math.max(1, (r as { reintentarEnS: number }).reintentarEnS) * MS_POR_S);
      return;
    }
    reintentos = 0;
    entregar(r);
  };

  const lanzar = (c: Controles) => {
    const control = new AbortController();
    enVuelo = control;
    enviar(c, control.signal)
      .catch((): Respuesta => ({ tipo: "ERROR" }))
      .then((r) => alResponder(c, r));
  };

  return {
    pedir(c) {
      if (!viva) return;
      limpiar();
      pendiente = null;
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
      enVuelo?.abort();
      enVuelo = null;
    },
  };
}
