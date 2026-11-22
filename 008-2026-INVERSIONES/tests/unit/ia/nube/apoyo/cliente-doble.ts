/**
 * Doble del cliente del SDK (lo que `crearCliente` devuelve): sin red ni llave. Anota con qué se construyó y cada
 * llamada a `messages.create` (el cuerpo y las opciones), y responde según la conducta, que puede lanzar en la llamada
 * misma, rechazar o devolver cualquier cosa.
 */
import type { ClienteMensajes, CuerpoNube, OpcionesPedidoNube } from "@/ia/nube/peticion";
import type { OpcionesClienteNube } from "@/ia/nube/transporte";

export interface LlamadaCliente {
  readonly cuerpo: CuerpoNube;
  readonly opciones: OpcionesPedidoNube;
}

export type ConductaCliente = (llamada: LlamadaCliente, indice: number) => unknown;

export interface ClienteDoble {
  readonly crearCliente: (opciones: OpcionesClienteNube) => ClienteMensajes;
  construcciones(): readonly OpcionesClienteNube[];
  llamadas(): readonly LlamadaCliente[];
}

export function crearClienteDoble(conducta: ConductaCliente): ClienteDoble {
  const construcciones: OpcionesClienteNube[] = [];
  const llamadas: LlamadaCliente[] = [];
  const cliente: ClienteMensajes = {
    messages: {
      create(cuerpo: CuerpoNube, opciones: OpcionesPedidoNube): PromiseLike<unknown> {
        const llamada = { cuerpo, opciones };
        llamadas.push(llamada);
        return conducta(llamada, llamadas.length - 1) as PromiseLike<unknown>;
      },
    },
  };
  return {
    crearCliente: (opciones) => {
      construcciones.push(opciones);
      return cliente;
    },
    construcciones: () => Object.freeze([...construcciones]),
    llamadas: () => Object.freeze([...llamadas]),
  };
}

/** Una promesa que se resuelve o se rechaza desde la prueba. */
export interface Diferida<T> {
  readonly promesa: Promise<T>;
  resolver(valor: T): void;
  rechazar(error: unknown): void;
}

export function diferida<T>(): Diferida<T> {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((si, no) => {
    resolver = si;
    rechazar = no;
  });
  return { promesa, resolver, rechazar };
}

/** Deja correr las tareas pendientes (microtareas y temporizadores vencidos). */
export const esperarTurnos = (): Promise<void> => new Promise((resolver) => setTimeout(resolver, 0));
