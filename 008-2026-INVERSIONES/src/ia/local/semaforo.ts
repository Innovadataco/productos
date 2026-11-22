/**
 * Un pedido a la vez hacia el Mac (PI tiene la prioridad): un turno por vez, en orden de llegada. Una espera se corta
 * con su señal y sale de la cola; una señal ya abortada no entra. Liberar es idempotente. El semáforo es de cada
 * instancia del generador: el servicio debe crear UNA sola instancia.
 */
export type Liberar = () => void;

export interface Semaforo {
  /** El turno (una función para liberarlo), o null si la señal se abortó antes de recibirlo. */
  tomar(senal: AbortSignal): Promise<Liberar | null>;
}

interface Espera {
  readonly entregar: (liberar: Liberar) => void;
}

export function crearSemaforo(): Semaforo {
  let ocupado = false;
  const cola: Espera[] = [];

  const crearLiberar = (): Liberar => {
    let liberado = false;
    return () => {
      if (liberado) return;
      liberado = true;
      const siguiente = cola.shift();
      if (siguiente === undefined) ocupado = false;
      else siguiente.entregar(crearLiberar());
    };
  };

  const tomar = (senal: AbortSignal): Promise<Liberar | null> => {
    if (senal.aborted) return Promise.resolve(null);
    if (!ocupado) {
      ocupado = true;
      return Promise.resolve(crearLiberar());
    }
    return new Promise((resolver) => {
      const alAbortar = (): void => {
        const indice = cola.indexOf(espera);
        if (indice >= 0) cola.splice(indice, 1);
        resolver(null);
      };
      const espera: Espera = {
        entregar: (liberar) => {
          senal.removeEventListener("abort", alAbortar);
          resolver(liberar);
        },
      };
      cola.push(espera);
      senal.addEventListener("abort", alAbortar, { once: true });
    });
  };

  return Object.freeze({ tomar });
}
