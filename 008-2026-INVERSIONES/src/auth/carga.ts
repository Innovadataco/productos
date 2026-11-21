/**
 * Carga de bcrypt (D-014, hallazgo MEDIO de security-reviewer). bcryptjs ocupa el hilo ~200 ms por hash
 * (medido en local), así que una ráfaga repartida entre muchas IP podría saturar el proceso aunque cada
 * IP respete su tope. Dos barreras de proceso, en memoria (la app es un solo contenedor):
 * - un semáforo: como máximo 2 bcrypt a la vez y una cola acotada (llena → ErrorOcupado → 429);
 * - un tope global: 60 intentos de ingreso o de definir clave por minuto, todas las IP juntas → 429.
 * Viven en `globalThis` para que todas las rutas del proceso compartan las mismas instancias.
 */
import { crearLimitador, type Decision } from "./limite-api";

export class ErrorOcupado extends Error {
  override readonly name = "ErrorOcupado";
}

export interface Semaforo {
  con<T>(tarea: () => Promise<T>): Promise<T>;
}

export function crearSemaforo(opciones: { readonly maximo: number; readonly maxEspera: number }): Semaforo {
  let activos = 0;
  const cola: Array<() => void> = [];
  const liberar = () => {
    const siguiente = cola.shift();
    if (siguiente) siguiente();
    else activos -= 1;
  };
  return {
    async con(tarea) {
      if (activos < opciones.maximo) {
        activos += 1;
      } else {
        if (cola.length >= opciones.maxEspera) throw new ErrorOcupado("Servicio ocupado.");
        // El permiso pasa directo del que termina al que espera: `activos` no cambia.
        await new Promise<void>((resolver) => cola.push(resolver));
      }
      try {
        return await tarea();
      } finally {
        liberar();
      }
    },
  };
}

const BCRYPT_A_LA_VEZ = 2;
const BCRYPT_EN_ESPERA = 20;
export const INGRESOS_POR_MINUTO = 60;
const MINUTO_MS = 60_000;

interface Carga {
  readonly semaforo: Semaforo;
  readonly tope: ReturnType<typeof crearLimitador>;
}

const CLAVE_GLOBAL = Symbol.for("inv008.carga");

function carga(): Carga {
  const g = globalThis as Record<symbol, Carga | undefined>;
  g[CLAVE_GLOBAL] ??= {
    semaforo: crearSemaforo({ maximo: BCRYPT_A_LA_VEZ, maxEspera: BCRYPT_EN_ESPERA }),
    tope: crearLimitador({ maximo: INGRESOS_POR_MINUTO, ventanaMs: MINUTO_MS, maxRedes: 1 }),
  };
  return g[CLAVE_GLOBAL];
}

/** Corre bcrypt bajo el semáforo del proceso. */
export const conBcrypt = <T>(tarea: () => Promise<T>): Promise<T> => carga().semaforo.con(tarea);

/** Registra un intento de ingreso (o de definir clave) en el tope global del proceso. */
export const admitirIngreso = (ahoraMs: number): Decision => carga().tope.registrar("global", ahoraMs);
