import "server-only";
/**
 * «Identificar modelos» y «Probar» de /edicion/ia (E8), detrás de la interfaz `SondaOllama`, con la lógica de PI:
 * - SOLO el destino GUARDADO en la configuración vigente, nunca uno que venga del pedido (I-24 de PI cerró así un SSRF);
 * - un Ollama inalcanzable da un estado estructurado («inalcanzable»), nunca una excepción (el «503 controlado» de PI);
 * - nada de rutas distintas de /api/tags y /api/generate (lo cuida el cliente de la puerta local, E4a).
 * La app de 008 NO tiene salida a la tailnet (por diseño, a diferencia de PI): en producción, y por omisión, la sonda
 * es la PENDIENTE y los botones dicen que la conexión la hará el servicio de IA (E6), que cambiará la implementación sin
 * tocar la pantalla. La DIRECTA (con el cliente de E4a sobre el `fetch` del proceso) es solo para desarrollo, para
 * probar hoy en el Mac, con `INV_IA_SONDA_OLLAMA=directa` y fuera de producción.
 * Cada modelo identificado queda marcado contra la lista de PI: seleccionable si está en la lista Y su digest coincide.
 */
import { ErrorLocal } from "../local/errores";
import { crearGeneradorLocal } from "../local/generador";
import type { BuscarLocal } from "../local/http";
import { identificarModelos, type ModeloInstalado } from "../local/identificar";
import type { ListaModelosPi } from "../local/modelos";
import { crearSemaforo, type Semaforo } from "../local/semaforo";
import { destinoDe, type ConfigIaVigente } from "./leer";
import { TAREAS_IA } from "./parametros";
import { VARIABLE_TOKEN_SERVICIO_IA, sondaServicio, tokenServicioValido, type BuscarServicio } from "./sonda-servicio";

/** La variable que enciende la sonda directa en desarrollo (su único valor válido es «directa»). */
export const VARIABLE_SONDA_OLLAMA = "INV_IA_SONDA_OLLAMA";
/** Identificar es solo /api/tags: corto y fijo. */
export const LIMITE_IDENTIFICAR_MS = 10_000;
const MS_POR_S = 1000;

/** Lo que se marca como «inalcanzable» (la red o el tiempo): puede ser el bloqueo del firewall de PI. */
const MOTIVOS_INALCANZABLE: readonly string[] = Object.freeze(["MODELO_NO_DISPONIBLE", "TIEMPO_AGOTADO"]);

export type IdentificacionCruda = { readonly ok: true; readonly modelos: readonly ModeloInstalado[] } | { readonly ok: false; readonly motivo: string; readonly detalle: string };
export type PruebaCruda =
  | { readonly ok: true; readonly latenciaMs: number; readonly smoke: string }
  | { readonly ok: false; readonly etapa: string; readonly motivo: string; readonly detalle: string; readonly latenciaMs: number };

/** La interfaz que el servicio de IA (E6) implementará sin tocar la pantalla. Recibe SOLO lo guardado. */
export interface SondaOllama {
  readonly tipo: "DIRECTA" | "PENDIENTE" | "SERVICIO";
  identificar(destino: string): Promise<IdentificacionCruda>;
  probar(destino: string, modelo: string, temperaturaCentesimas: number, limiteMs: number): Promise<PruebaCruda>;
}

const PENDIENTE = Object.freeze({ ok: false, motivo: "PENDIENTE", detalle: "SERVICIO_IA_PENDIENTE" } as const);

/** La de producción y la de omisión: la app no llega a la tailnet; la conexión la hará el servicio de IA. */
export const SONDA_PENDIENTE: SondaOllama = Object.freeze({
  tipo: "PENDIENTE",
  identificar: () => Promise.resolve(PENDIENTE),
  probar: () => Promise.resolve({ ...PENDIENTE, etapa: "PING", latenciaMs: 0 }),
});

/**
 * La directa: el cliente de la puerta local de E4a sobre `fetch`, un pedido a la vez. La usan el desarrollo y el servicio
 * inv-008-ia (E6), que le pasa SU turno para que la corrida diaria y los pedidos a demanda no vayan a la vez al Mac.
 */
export function sondaDirecta(fetch: BuscarLocal, semaforo: Semaforo = crearSemaforo()): SondaOllama {
  return Object.freeze({
    tipo: "DIRECTA",
    async identificar(destino: string): Promise<IdentificacionCruda> {
      try {
        const r = await identificarModelos(destino, { fetch }, { limiteMs: LIMITE_IDENTIFICAR_MS });
        return r.ok ? r : { ok: false, motivo: r.motivo, detalle: r.detalle };
      } catch (error) {
        return { ok: false, motivo: "ERROR_PROVEEDOR", detalle: error instanceof ErrorLocal ? error.codigo : "EXCEPCION_INTERNA" };
      }
    },
    async probar(destino: string, modelo: string, temperaturaCentesimas: number, limiteMs: number): Promise<PruebaCruda> {
      try {
        const local = crearGeneradorLocal({ destino, modelo, temperaturaCentesimas }, { fetch, semaforo });
        return await local.sondaLocal({ smoke: true, limiteMs });
      } catch (error) {
        return { ok: false, etapa: "PING", motivo: "ERROR_PROVEEDOR", detalle: error instanceof ErrorLocal ? error.codigo : "EXCEPCION_INTERNA", latenciaMs: 0 };
      }
    },
  });
}

/** La directa del proceso: una sola (un solo turno al Mac para todas las acciones). */
let directaDelProceso: SondaOllama | null = null;

/** La del servicio inv-008-ia del proceso, con el token con el que se creó (si el token cambia, se crea otra). */
let servicioDelProceso: { readonly token: string; readonly sonda: SondaOllama } | null = null;

/**
 * La sonda del entorno: la directa solo fuera de producción y con la variable exacta; si no, la del servicio inv-008-ia
 * (E6) cuando el entorno trae su token con la forma debida; si no, la pendiente.
 */
export function sondaDelEntorno(entorno: Readonly<Record<string, string | undefined>>): SondaOllama {
  const directa = entorno.NODE_ENV !== "production" && entorno[VARIABLE_SONDA_OLLAMA] === "directa";
  if (directa) {
    directaDelProceso ??= sondaDirecta(globalThis.fetch as unknown as BuscarLocal);
    return directaDelProceso;
  }
  const token = entorno[VARIABLE_TOKEN_SERVICIO_IA];
  if (!tokenServicioValido(token)) return SONDA_PENDIENTE;
  if (servicioDelProceso?.token !== token) servicioDelProceso = { token, sonda: sondaServicio((url, init) => globalThis.fetch(url, init) as ReturnType<BuscarServicio>, token) };
  return servicioDelProceso.sonda;
}

export interface ModeloIdentificado extends ModeloInstalado {
  readonly enLista: boolean;
  /** null si no está en la lista; true si el digest instalado es el que publicó PI. */
  readonly digestCoincide: boolean | null;
  /** En la lista de PI y con su digest: Jelk lo puede elegir. */
  readonly seleccionable: boolean;
  /** La nota de PI, si la trae. */
  readonly nota: string | null;
}

export type ResultadoIdentificar =
  | { readonly estado: "OK"; readonly modelos: readonly ModeloIdentificado[] }
  | { readonly estado: "SIN_DESTINO" }
  | { readonly estado: "PENDIENTE" }
  | { readonly estado: "INALCANZABLE"; readonly detalle: string }
  | { readonly estado: "ERROR"; readonly detalle: string };

function marcar(modelo: ModeloInstalado, lista: ListaModelosPi): ModeloIdentificado {
  const dePi = lista.estado === "LISTA" ? lista.modelos.find((m) => m.nombre === modelo.nombre) : undefined;
  const digestCoincide = dePi === undefined ? null : dePi.digest !== null && dePi.digest === modelo.digest;
  return Object.freeze({ ...modelo, enLista: dePi !== undefined, digestCoincide, seleccionable: digestCoincide === true, nota: dePi?.nota ?? null });
}

const falloDe = (r: { readonly motivo: string; readonly detalle: string }): ResultadoIdentificar =>
  r.motivo === "PENDIENTE" ? { estado: "PENDIENTE" } : MOTIVOS_INALCANZABLE.includes(r.motivo) ? { estado: "INALCANZABLE", detalle: r.detalle } : { estado: "ERROR", detalle: r.detalle };

/** Lo instalado en el destino GUARDADO, marcado contra la lista de PI. Nunca lanza. */
export async function identificarGuardado(config: ConfigIaVigente | null, sonda: SondaOllama, lista: ListaModelosPi): Promise<ResultadoIdentificar> {
  const destino = destinoDe(config);
  if (destino === null) return { estado: "SIN_DESTINO" };
  const r = await sonda.identificar(destino);
  return r.ok ? Object.freeze({ estado: "OK", modelos: Object.freeze(r.modelos.map((m) => marcar(m, lista))) }) : Object.freeze(falloDe(r));
}

export interface Prueba {
  readonly modelo: string;
  readonly ok: boolean;
  readonly latenciaMs: number;
  readonly etapa: string | null;
  readonly detalle: string | null;
  /** Falló por la red o el tiempo: puede ser el bloqueo del firewall de PI. */
  readonly inalcanzable: boolean;
}

export type ResultadoProbar =
  | { readonly estado: "OK" | "FALLO"; readonly pruebas: readonly Prueba[] }
  | { readonly estado: "SIN_DESTINO" | "SIN_MODELO" | "PENDIENTE" };

const prueba = (modelo: string, r: PruebaCruda): Prueba =>
  Object.freeze(r.ok
    ? { modelo, ok: true, latenciaMs: r.latenciaMs, etapa: null, detalle: null, inalcanzable: false }
    : { modelo, ok: false, latenciaMs: r.latenciaMs, etapa: r.etapa, detalle: r.detalle, inalcanzable: MOTIVOS_INALCANZABLE.includes(r.motivo) });

/** El ping y el smoke de cada modelo distinto de las tareas activas, en el destino GUARDADO, uno a la vez. Nunca lanza. */
export async function probarGuardado(config: ConfigIaVigente | null, sonda: SondaOllama): Promise<ResultadoProbar> {
  const destino = destinoDe(config);
  if (config === null || destino === null) return { estado: "SIN_DESTINO" };
  const modelos = [...new Set(TAREAS_IA.filter((t) => config.tareas[t].activo).map((t) => config.tareas[t].modeloLocal).filter((m): m is string => m !== null))];
  if (modelos.length === 0) return { estado: "SIN_MODELO" };
  if (sonda.tipo === "PENDIENTE") return { estado: "PENDIENTE" };
  const pruebas: Prueba[] = [];
  for (const modelo of modelos) pruebas.push(prueba(modelo, await sonda.probar(destino, modelo, config.temperaturaCentesimas, config.limiteSegundos * MS_POR_S)));
  return Object.freeze({ estado: pruebas.every((p) => p.ok) ? "OK" : "FALLO", pruebas: Object.freeze(pruebas) });
}
