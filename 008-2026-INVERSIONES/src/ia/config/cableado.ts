import "server-only";
/**
 * El cableado de la configuración vigente con las puertas (E8): el modo, el límite por pedido, el modelo local de CADA
 * tarea, la temperatura de la local y el modelo, el esfuerzo y el tope de la nube salen de `config_ia`, no de las
 * constantes. Lo usará el servicio de los resúmenes (E6):
 *   const config = await leerConfigIa(db);
 *   const generadores = generadoresDeConfig(config, tarea, entorno, dependencias);
 *   const resultado = await generarSegunConfig(config, generadores, { paquete, prompt, esquemaSalida });
 * Sin configuración, con el modo apagado o con la tarea inactiva, no se llama a nadie (APAGADO). La guarda de la vista
 * ciega y el orden de las puertas son los de `generarConPuertas`, sin cambios.
 */
import type { PaqueteHechos } from "../contrato";
import { armarPedido, type EsquemaSalida, type Generador, type PromptVersionado } from "../generador";
import { crearGeneradorLocal, type ConfigLocal } from "../local/generador";
import type { BuscarLocal } from "../local/http";
import { crearSemaforo, type Semaforo } from "../local/semaforo";
import { configNubeDesde, type ConfigNube } from "../nube/config";
import { crearGeneradorNube, type DependenciasNube } from "../nube/generador-nube";
import { generarConPuertas, type ModoPuertas, type ResultadoPuertas } from "../puertas";
import { destinoDe, type ConfigIaVigente } from "./leer";
import type { TareaIa } from "./parametros";

const MS_POR_S = 1000;

export type Corrida =
  | { readonly estado: "APAGADO"; readonly motivo: "SIN_CONFIGURACION" | "MODO_APAGADO" | "TAREA_INACTIVA" }
  | { readonly estado: "LISTA"; readonly tarea: TareaIa; readonly modo: ModoPuertas; readonly limiteMs: number; readonly modeloLocal: string | null };

/** Qué dice la configuración para una tarea. */
export function corridaDe(config: ConfigIaVigente | null, tarea: TareaIa): Corrida {
  if (config === null) return Object.freeze({ estado: "APAGADO", motivo: "SIN_CONFIGURACION" });
  if (config.modo === "apagado") return Object.freeze({ estado: "APAGADO", motivo: "MODO_APAGADO" });
  const t = config.tareas[tarea];
  if (!t.activo) return Object.freeze({ estado: "APAGADO", motivo: "TAREA_INACTIVA" });
  return Object.freeze({ estado: "LISTA", tarea, modo: config.modo, limiteMs: config.limiteSegundos * MS_POR_S, modeloLocal: t.modeloLocal });
}

/** La configuración de la puerta local para una tarea (destino guardado, su modelo y la temperatura), o null. */
export function configLocalDe(config: ConfigIaVigente | null, tarea: TareaIa): ConfigLocal | null {
  const destino = destinoDe(config);
  const modelo = config?.tareas[tarea].modeloLocal ?? null;
  if (config === null || destino === null || modelo === null) return null;
  return Object.freeze({ destino, modelo, temperaturaCentesimas: config.temperaturaCentesimas });
}

/** La configuración de la nube: la llave del entorno; el tope, el modelo y el esfuerzo de la configuración. */
export function configNubeDe(config: ConfigIaVigente | null, entorno: Readonly<Record<string, string | undefined>>): ConfigNube {
  if (config === null) return Object.freeze({ lista: false, detalle: "SIN_TOPE" });
  return configNubeDesde(entorno, { topeMicroUsd: config.topeMicroUsd, modelo: config.modeloNube, esfuerzo: config.esfuerzoNube });
}

export interface DependenciasCableado {
  /** El `fetch` de la puerta local (en el servicio, el que llega al Mac por la tailnet). */
  readonly fetchLocal: BuscarLocal;
  readonly gastoDelMes: DependenciasNube["gastoDelMes"];
  readonly fetchNube?: typeof fetch;
  readonly crearCliente?: DependenciasNube["crearCliente"];
  /** Un turno compartido para la local: un pedido a la vez al Mac aunque cada tarea tenga su modelo. */
  readonly semaforo?: Semaforo;
}

/** La local si se puede armar (si no, queda sin generador: PUERTA_APAGADA), sin tumbar nada si el modelo salió de la lista. */
function generadorLocal(config: ConfigIaVigente | null, tarea: TareaIa, dependencias: DependenciasCableado): Generador | null {
  const local = configLocalDe(config, tarea);
  if (local === null) return null;
  try {
    return crearGeneradorLocal(local, { fetch: dependencias.fetchLocal, semaforo: dependencias.semaforo ?? crearSemaforo() });
  } catch {
    console.error("[ia-config] la puerta local no se pudo armar con la configuración vigente (el modelo no está en la lista de PI o el destino cambió de forma)");
    return null;
  }
}

/** Los generadores de las dos puertas para una tarea, con la configuración vigente (la nube, apagada si le falta algo). */
export function generadoresDeConfig(config: ConfigIaVigente | null, tarea: TareaIa, entorno: Readonly<Record<string, string | undefined>>, dependencias: DependenciasCableado): readonly Generador[] {
  const local = generadorLocal(config, tarea, dependencias);
  const nube = crearGeneradorNube(configNubeDe(config, entorno), {
    gastoDelMes: dependencias.gastoDelMes,
    ...(dependencias.fetchNube === undefined ? {} : { fetch: dependencias.fetchNube }),
    ...(dependencias.crearCliente === undefined ? {} : { crearCliente: dependencias.crearCliente }),
  });
  return Object.freeze(local === null ? [nube] : [local, nube]);
}

export interface EntradaCorrida {
  readonly paquete: PaqueteHechos;
  readonly prompt: PromptVersionado;
  readonly esquemaSalida: EsquemaSalida;
}

const APAGADO: ResultadoPuertas = Object.freeze({ estado: "APAGADO", ok: false });

/** Una corrida de la tarea del paquete con la configuración vigente: el pedido con su límite y las puertas de su modo. */
export async function generarSegunConfig(config: ConfigIaVigente | null, generadores: readonly Generador[], entrada: EntradaCorrida): Promise<ResultadoPuertas> {
  const corrida = corridaDe(config, entrada.paquete.tipo);
  if (corrida.estado === "APAGADO") return APAGADO;
  const pedido = armarPedido({ paquete: entrada.paquete, prompt: entrada.prompt, esquemaSalida: entrada.esquemaSalida, limiteMs: corrida.limiteMs });
  return generarConPuertas(generadores, corrida.modo, pedido, entrada.paquete);
}
