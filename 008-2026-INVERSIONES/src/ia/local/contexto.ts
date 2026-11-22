/**
 * El contexto de una instancia de la puerta local, y los pasos que comparten `generar` y la sonda: consultar el modelo
 * en `/api/tags`, tomar el turno y pedir una generación. La configuración se valida al crear (cierra en fallo con
 * `ErrorLocal`, sin repetir valores): el destino de la tailnet, un modelo de la lista cerrada y un `fetch` inyectado
 * (obligatorio, sin valor por omisión: ninguna prueba sale a la red por descuido).
 */
import { esObjetoPlano, soloCampos } from "../formas";
import { urlLocal, leerDestinoLocal } from "./destino";
import { ErrorLocal, falloLocal, type FalloLocal } from "./errores";
import { BYTES_MAXIMOS_GENERAR, BYTES_MAXIMOS_TAGS, pedirJsonLocal, type BuscarLocal } from "./http";
import { modeloAprobado } from "./modelos";
import { leerGeneracion, verificarModelo, type Generacion } from "./ollama";
import type { Plazo } from "./plazo";
import { crearSemaforo, type Liberar, type Semaforo } from "./semaforo";

export interface ConfigLocal {
  /** `http://<IPv4 de la tailnet>:<puerto>` (ver `leerDestinoLocal`). */
  readonly destino: string;
  /** Un nombre de la lista cerrada de `modelos.ts`. */
  readonly modelo: string;
}

export interface DependenciasLocal {
  /** Obligatorio. En producción, el `fetch` global; en las pruebas, uno falso. */
  readonly fetch: BuscarLocal;
  /** Reloj monótono en milisegundos, para la latencia. Por omisión, `performance.now`. */
  readonly ahora?: () => number;
}

export interface ContextoLocal {
  readonly urlTags: string;
  readonly urlGenerar: string;
  readonly nombre: string;
  /** null mientras el digest del modelo no se haya medido en el Mac. */
  readonly digest: string | null;
  readonly buscar: BuscarLocal;
  readonly ahora: () => number;
  readonly semaforo: Semaforo;
}

const CAMPOS_CONFIG: readonly string[] = Object.freeze(["destino", "modelo"]);
const CAMPOS_DEPENDENCIAS: readonly string[] = Object.freeze(["fetch", "ahora"]);
const relojDelSistema = (): number => performance.now();

export function crearContexto(config: ConfigLocal, dependencias: DependenciasLocal): ContextoLocal {
  const crudo: unknown = config;
  if (!esObjetoPlano(crudo) || !soloCampos(crudo, CAMPOS_CONFIG)) throw new ErrorLocal("CONFIGURACION_INVALIDA");
  const destino = leerDestinoLocal(crudo.destino as string | undefined);
  const aprobado = modeloAprobado(crudo.modelo);
  if (aprobado === null) throw new ErrorLocal("MODELO_NO_APROBADO");
  const deps: unknown = dependencias;
  if (!esObjetoPlano(deps) || !soloCampos(deps, CAMPOS_DEPENDENCIAS)) throw new ErrorLocal("CONFIGURACION_INVALIDA");
  const { fetch: buscar, ahora } = deps;
  if (typeof buscar !== "function" || (ahora !== undefined && typeof ahora !== "function")) throw new ErrorLocal("CONFIGURACION_INVALIDA");
  return Object.freeze({
    urlTags: urlLocal(destino, "/api/tags"),
    urlGenerar: urlLocal(destino, "/api/generate"),
    nombre: aprobado.nombre,
    digest: aprobado.digest,
    buscar: buscar as BuscarLocal,
    ahora: (ahora as (() => number) | undefined) ?? relojDelSistema,
    semaforo: crearSemaforo(),
  });
}

/** GET /api/tags: el modelo aprobado está, con su digest. */
export async function consultarModelo(contexto: ContextoLocal, digest: string, plazo: Plazo): Promise<{ readonly ok: true } | FalloLocal> {
  const tags = await pedirJsonLocal(contexto.buscar, contexto.urlTags, { method: "GET" }, BYTES_MAXIMOS_TAGS, plazo);
  return tags.ok ? verificarModelo(tags.datos, { nombre: contexto.nombre, digest }) : tags;
}

/** El turno de la instancia, o TIEMPO_AGOTADO si el plazo vence (o la señal se aborta) esperándolo. */
export async function tomarTurno(contexto: ContextoLocal, plazo: Plazo): Promise<Liberar | FalloLocal> {
  const liberar = await contexto.semaforo.tomar(plazo.senal);
  if (liberar !== null) return liberar;
  return falloLocal("TIEMPO_AGOTADO", plazo.causa() === "SENAL_ABORTADA" ? "SENAL_ABORTADA" : "LIMITE_EN_ESPERA");
}

/** POST /api/generate con el cuerpo dado, leído como una generación del modelo aprobado. */
export async function pedirGeneracion(contexto: ContextoLocal, cuerpo: string, plazo: Plazo): Promise<{ readonly ok: true; readonly generacion: Generacion } | FalloLocal> {
  const respuesta = await pedirJsonLocal(contexto.buscar, contexto.urlGenerar, { method: "POST", body: cuerpo }, BYTES_MAXIMOS_GENERAR, plazo);
  return respuesta.ok ? leerGeneracion(respuesta.datos, contexto.nombre) : respuesta;
}
