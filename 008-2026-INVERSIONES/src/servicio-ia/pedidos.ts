/**
 * Los pedidos a demanda de la app al servicio inv-008-ia (E6): «Identificar modelos» y «Probar» de /edicion/ia. Puro
 * (sin HTTP): recibe el pedido ya leído y devuelve el estado y el cuerpo. El servidor es `servidor.ts`.
 * - Solo POST /identificar y POST /probar. El resto, 404 o 405.
 * - Token compartido en `authorization: Bearer`, comparado en tiempo constante (sobre sus sha256). Sin él, 401, antes de
 *   mirar nada más.
 * - El destino del Ollama es SIEMPRE el guardado en config_ia: el cuerpo no puede traer uno (claves exactas; 400 si trae
 *   otra cosa). De «Probar» solo se acepta el nombre de un modelo de una tarea ACTIVA de la configuración; la
 *   temperatura y el límite son los guardados.
 * - Uno a la vez (429 si hay otro en curso): «Probar» carga el modelo en el Mac de PI.
 * - Una excepción no sale: 500 con un código, sin el mensaje.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { destinoDe, type ConfigIaVigente } from "../ia/config/leer";
import { TAREAS_IA } from "../ia/config/parametros";
import type { SondaOllama } from "../ia/config/sonda-ollama";
import { RUTA_IDENTIFICAR, RUTA_PROBAR } from "../ia/config/sonda-servicio";
import { esObjetoPlano, soloCampos } from "../ia/formas";

export interface PedidoHttp {
  readonly metodo: string;
  readonly ruta: string;
  readonly autorizacion: string | undefined;
  readonly cuerpo: string;
}

export interface RespuestaIa {
  readonly estado: number;
  readonly cuerpo: unknown;
}

export interface DependenciasPedidos {
  readonly token: string;
  leerConfig(): Promise<ConfigIaVigente | null>;
  /** La sonda directa del servicio (con su `fetch` acotado y su turno). */
  readonly sonda: SondaOllama;
}

export type Atender = (pedido: PedidoHttp) => Promise<RespuestaIa>;

const MS_POR_S = 1000;
const PREFIJO = "Bearer ";
const RUTAS: readonly string[] = [RUTA_IDENTIFICAR, RUTA_PROBAR];
const error = (estado: number, codigo: string): RespuestaIa => Object.freeze({ estado, cuerpo: Object.freeze({ error: codigo }) });
const sha256 = (texto: string): Buffer => createHash("sha256").update(texto, "utf8").digest();

function autorizado(autorizacion: string | undefined, token: string): boolean {
  if (typeof autorizacion !== "string" || !autorizacion.startsWith(PREFIJO)) return false;
  return timingSafeEqual(sha256(autorizacion.slice(PREFIJO.length)), sha256(token));
}

/** El cuerpo como objeto con exactamente esas claves; null si no. */
function leerCuerpo(cuerpo: string, claves: readonly string[]): Record<string, unknown> | null {
  let datos: unknown;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return null;
  }
  return esObjetoPlano(datos) && soloCampos(datos, claves) && claves.every((c) => Object.hasOwn(datos, c)) ? datos : null;
}

const modelosActivos = (config: ConfigIaVigente): readonly string[] =>
  TAREAS_IA.filter((t) => config.tareas[t].activo).map((t) => config.tareas[t].modeloLocal).filter((m): m is string => m !== null);

async function identificar(deps: DependenciasPedidos, cuerpo: string): Promise<RespuestaIa> {
  if (leerCuerpo(cuerpo, []) === null) return error(400, "CUERPO_INVALIDO");
  const destino = destinoDe(await deps.leerConfig());
  if (destino === null) return { estado: 200, cuerpo: { ok: false, motivo: "ERROR_PROVEEDOR", detalle: "SIN_DESTINO" } };
  return { estado: 200, cuerpo: await deps.sonda.identificar(destino) };
}

async function probar(deps: DependenciasPedidos, cuerpo: string): Promise<RespuestaIa> {
  const datos = leerCuerpo(cuerpo, ["modelo"]);
  if (datos === null || typeof datos.modelo !== "string") return error(400, "CUERPO_INVALIDO");
  const config = await deps.leerConfig();
  const destino = destinoDe(config);
  const fallo = (detalle: string): RespuestaIa => ({ estado: 200, cuerpo: { ok: false, etapa: "PING", motivo: "ERROR_PROVEEDOR", detalle, latenciaMs: 0 } });
  if (config === null || destino === null) return fallo("SIN_DESTINO");
  if (!modelosActivos(config).includes(datos.modelo)) return fallo("MODELO_NO_CONFIGURADO");
  return { estado: 200, cuerpo: await deps.sonda.probar(destino, datos.modelo, config.temperaturaCentesimas, config.limiteSegundos * MS_POR_S) };
}

export function crearAtencion(deps: DependenciasPedidos): Atender {
  let enCurso = false;
  return async (pedido) => {
    if (!autorizado(pedido.autorizacion, deps.token)) return error(401, "NO_AUTORIZADO");
    if (!RUTAS.includes(pedido.ruta)) return error(404, "RUTA_DESCONOCIDA");
    if (pedido.metodo !== "POST") return error(405, "METODO_NO_PERMITIDO");
    if (enCurso) return error(429, "OCUPADO");
    enCurso = true;
    try {
      return await (pedido.ruta === RUTA_IDENTIFICAR ? identificar(deps, pedido.cuerpo) : probar(deps, pedido.cuerpo));
    } catch {
      return error(500, "ERROR_INTERNO");
    } finally {
      enCurso = false;
    }
  };
}
