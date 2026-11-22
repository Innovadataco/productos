import "server-only";
/**
 * El estado de cada puerta (E8), puro: si está lista o qué le falta, desde lo que la app puede saber. Lo que no puede
 * saber sale «por verificar», NUNCA «listo»:
 * - la local: la lista de PI, el destino guardado, un modelo de la lista en cada tarea activa y su digest (de la lista)
 *   se saben; la sonda (la hace el servicio de IA, pendiente) y los candados de red de PI (I-464) no;
 * - la nube: la llave (solo si la variable no está vacía, nunca su valor) y el tope se saben; el proxy de salida, los
 *   precios (de la skill, por verificar antes de encender) y el servicio de IA no.
 * Por eso ninguna puerta queda «lista» desde la pantalla: lo que se puede ver es si le falta algo.
 */
import type { Puerta } from "../generador";
import type { ListaModelosPi } from "../local/modelos";
import { destinoDe, type ConfigIaVigente } from "./leer";
import { TAREAS_IA, usaLocal, usaNube } from "./parametros";

export type EstadoRequisito = "LISTO" | "FALTA" | "POR_VERIFICAR";

export interface Requisito {
  readonly clave: string;
  readonly estado: EstadoRequisito;
  /** Un código (sin datos). */
  readonly detalle: string;
}

export interface EstadoPuerta {
  readonly puerta: Puerta;
  /** Si el modo vigente la usa. */
  readonly enUso: boolean;
  /** FALTA si algo falta; si no, POR_VERIFICAR si algo no se puede saber; si no, LISTO. */
  readonly estado: EstadoRequisito;
  readonly requisitos: readonly Requisito[];
}

export interface EntornoIa {
  /** Si la variable de la llave de la nube existe y no está vacía en el entorno de la app (nunca su valor). */
  readonly llaveNube: boolean;
  readonly listaPi: ListaModelosPi;
}

const req = (clave: string, estado: EstadoRequisito, detalle: string): Requisito => Object.freeze({ clave, estado, detalle });

function listaPi(lista: ListaModelosPi): Requisito {
  if (lista.estado === "SIN_LISTA") return req("LISTA_PI", "FALTA", lista.motivo);
  return lista.modelos.length === 0 ? req("LISTA_PI", "FALTA", "LISTA_VACIA") : req("LISTA_PI", "LISTO", "LISTA_PUBLICADA");
}

/** Los modelos de las tareas activas contra la lista; y si se conoce el digest de cada uno (viene de la lista). */
function modelos(config: ConfigIaVigente | null, lista: ListaModelosPi): readonly [Requisito, Requisito] {
  if (config === null) return [req("MODELOS", "FALTA", "SIN_CONFIGURACION"), req("DIGEST", "FALTA", "SIN_DIGEST_DE_PI")];
  const activos = TAREAS_IA.filter((t) => config.tareas[t].activo).map((t) => config.tareas[t].modeloLocal);
  const enLista = new Map(lista.estado === "LISTA" ? lista.modelos.map((m) => [m.nombre, m.digest] as const) : []);
  const digests = activos.map((m) => (m === null ? null : (enLista.get(m) ?? null)));
  const digest = activos.length > 0 && digests.every((d) => d !== null) ? req("DIGEST", "LISTO", "DIGEST_DE_PI") : req("DIGEST", "FALTA", "SIN_DIGEST_DE_PI");
  if (activos.length === 0) return [req("MODELOS", "FALTA", "SIN_TAREAS_ACTIVAS"), digest];
  if (activos.some((m) => m === null)) return [req("MODELOS", "FALTA", "MODELO_FALTA"), digest];
  if (activos.some((m) => !enLista.has(m as string))) return [req("MODELOS", "FALTA", "MODELO_FUERA_DE_LISTA"), digest];
  return [req("MODELOS", "LISTO", "MODELOS_DE_LA_LISTA"), digest];
}

function resumen(requisitos: readonly Requisito[]): EstadoRequisito {
  if (requisitos.some((r) => r.estado === "FALTA")) return "FALTA";
  return requisitos.some((r) => r.estado === "POR_VERIFICAR") ? "POR_VERIFICAR" : "LISTO";
}

const puerta = (p: Puerta, enUso: boolean, requisitos: readonly Requisito[]): EstadoPuerta =>
  Object.freeze({ puerta: p, enUso, estado: resumen(requisitos), requisitos: Object.freeze([...requisitos]) });

/** El estado de la puerta local y de la nube, en ese orden. Pura. */
export function estadoPuertas(config: ConfigIaVigente | null, entorno: EntornoIa): readonly EstadoPuerta[] {
  const [modelosReq, digestReq] = modelos(config, entorno.listaPi);
  const local = [
    listaPi(entorno.listaPi),
    destinoDe(config) === null ? req("DESTINO", "FALTA", "SIN_DESTINO") : req("DESTINO", "LISTO", "DESTINO_GUARDADO"),
    modelosReq,
    digestReq,
    req("SONDA", "POR_VERIFICAR", "SERVICIO_IA_PENDIENTE"),
    req("RED_PI", "POR_VERIFICAR", "CANDADOS_DE_RED_DE_PI"),
  ];
  const nube = [
    entorno.llaveNube ? req("LLAVE", "LISTO", "LLAVE_CARGADA") : req("LLAVE", "FALTA", "SIN_LLAVE"),
    config?.topeMicroUsd == null ? req("TOPE", "FALTA", "SIN_TOPE") : req("TOPE", "LISTO", "TOPE_GUARDADO"),
    req("PROXY_SALIDA", "POR_VERIFICAR", "PROXY_DE_SALIDA"),
    req("PRECIOS", "POR_VERIFICAR", "PRECIOS_DE_LA_SKILL"),
    req("SERVICIO_IA", "POR_VERIFICAR", "SERVICIO_IA_PENDIENTE"),
  ];
  return Object.freeze([
    puerta("local", config !== null && usaLocal(config.modo), local),
    puerta("nube", config !== null && usaNube(config.modo), nube),
  ]);
}
