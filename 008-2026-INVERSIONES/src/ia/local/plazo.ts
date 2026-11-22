/**
 * El plazo de un pedido a la puerta local: una señal propia que se aborta con la señal de afuera (la del orquestador)
 * o con el límite propio (`limiteMs`), y que recuerda cuál llegó primero. `esperar` deja esperar una promesa sin
 * colgarse aunque esa promesa ignore la señal (un `fetch` que no la respeta), y nunca deja un rechazo sin atender.
 * `cerrar` quita el temporizador y la escucha de la señal de afuera.
 */
export type CausaAborto = "SENAL_ABORTADA" | "LIMITE_DEL_CLIENTE";

export type Espera<T> =
  | { readonly tipo: "VALOR"; readonly valor: T }
  | { readonly tipo: "ERROR"; readonly error: unknown }
  | { readonly tipo: "ABORTADO" };

export interface Plazo {
  readonly senal: AbortSignal;
  /** Por qué se abortó, o null si sigue vivo. */
  causa(): CausaAborto | null;
  esperar<T>(promesa: Promise<T>): Promise<Espera<T>>;
  cerrar(): void;
}

export function abrirPlazo(afuera: AbortSignal | undefined, limiteMs: number): Plazo {
  const control = new AbortController();
  let causa: CausaAborto | null = null;
  const abortar = (porque: CausaAborto): void => {
    if (causa !== null) return;
    causa = porque;
    control.abort();
  };
  const alAbortarAfuera = (): void => abortar("SENAL_ABORTADA");
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  if (afuera?.aborted === true) abortar("SENAL_ABORTADA");
  else {
    afuera?.addEventListener("abort", alAbortarAfuera, { once: true });
    temporizador = setTimeout(() => abortar("LIMITE_DEL_CLIENTE"), limiteMs);
  }
  const abortado = new Promise<Espera<never>>((resolver) => {
    if (control.signal.aborted) resolver({ tipo: "ABORTADO" });
    else control.signal.addEventListener("abort", () => resolver({ tipo: "ABORTADO" }), { once: true });
  });

  return Object.freeze({
    senal: control.signal,
    causa: (): CausaAborto | null => causa,
    esperar<T>(promesa: Promise<T>): Promise<Espera<T>> {
      const llegada = promesa.then((valor): Espera<T> => ({ tipo: "VALOR", valor }), (error: unknown): Espera<T> => ({ tipo: "ERROR", error }));
      if (control.signal.aborted) return Promise.resolve({ tipo: "ABORTADO" });
      return Promise.race([llegada, abortado]);
    },
    cerrar(): void {
      clearTimeout(temporizador);
      afuera?.removeEventListener("abort", alAbortarAfuera);
    },
  });
}
