import "server-only";
/**
 * El cliente de la app hacia el servicio inv-008-ia para el botón «Analizar con IA»: pedir el análisis de UNA tarea
 * (POST /analizar) y leer el estado (POST /estado-analisis). Las mismas reglas de la sonda (sonda-servicio.ts):
 * - la dirección del servicio sale de configuración y se valida (`leerOrigenServicioIa`); el token compartido va en
 *   `authorization: Bearer`; sin token con la forma debida o con una dirección que no vale, no hay cliente y no se manda nada;
 * - solo viaja la tarea: el modelo, el destino del Ollama y el límite son los guardados en config_ia, los usa el servicio;
 * - nada lanza: el servicio caído es SERVICIO_NO_DISPONIBLE; una respuesta con otra forma se descarta; se copian solo los
 *   campos del contrato, ya revisados.
 * Quién puede pedir (el dueño), el interruptor y las condiciones de PI las exige la ruta y las exige el servicio.
 */
import { esDe, esObjetoPlano } from "../formas";
import { TAREAS_IA, type TareaIa } from "./parametros";
import {
  RUTA_ANALIZAR, RUTA_ESTADO_ANALISIS, leerOrigenServicioIa, tokenServicioValido, VARIABLE_TOKEN_SERVICIO_IA, type BuscarServicio,
} from "./sonda-servicio";

/** El servicio responde enseguida (no espera al modelo): un plazo corto basta. */
export const LIMITE_ANALISIS_SERVICIO_MS = 10_000;
const MAX_RESPUESTA = 4096;
const MAX_ESPERA_S = 3600;
const PATRON_ESTADO = /^[A-Z][A-Z_]{0,31}$/;

export type MotivoAnalisis =
  | "ANALISIS_APAGADO" | "TAREA_INACTIVA" | "OCUPADO" | "ESPERA_MINIMA" | "SERVICIO_TOKEN" | "SERVICIO_NO_DISPONIBLE" | "RESPUESTA_INVALIDA";

export type PedidoAnalisis =
  | { readonly ok: true; readonly lugar: "EN_CURSO" | "EN_ESPERA" }
  | { readonly ok: false; readonly motivo: MotivoAnalisis; readonly reintentarEnS?: number };

export interface EstadoAnalisisVista {
  readonly enCurso: TareaIa | null;
  readonly enEspera: TareaIa | null;
  readonly reintentarEnS: number;
  readonly ultimo: { readonly tarea: TareaIa; readonly estado: string } | null;
}

export type LecturaEstado = { readonly ok: true; readonly estado: EstadoAnalisisVista } | { readonly ok: false; readonly motivo: MotivoAnalisis };

export interface ClienteAnalisis {
  pedir(tarea: TareaIa): Promise<PedidoAnalisis>;
  estado(): Promise<LecturaEstado>;
}

type Crudo = { readonly estado: number; readonly datos: unknown } | { readonly falla: "SERVICIO_NO_DISPONIBLE" };

const fallo = (motivo: MotivoAnalisis, reintentarEnS?: number): { readonly ok: false; readonly motivo: MotivoAnalisis; readonly reintentarEnS?: number } =>
  Object.freeze(reintentarEnS === undefined ? { ok: false as const, motivo } : { ok: false as const, motivo, reintentarEnS });
const INVALIDA = fallo("RESPUESTA_INVALIDA");
const esSegundos = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_ESPERA_S;
const esTarea = (v: unknown): v is TareaIa => esDe(TAREAS_IA, v);

async function pedirAlServicio(buscar: BuscarServicio, token: string, origen: string, ruta: string, cuerpo: string): Promise<Crudo> {
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), LIMITE_ANALISIS_SERVICIO_MS);
  try {
    const respuesta = await buscar(`${origen}${ruta}`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" }, body: cuerpo,
      signal: control.signal, redirect: "error",
    });
    const texto = await respuesta.text();
    if (texto.length > MAX_RESPUESTA) return { estado: respuesta.status, datos: undefined };
    try {
      return { estado: respuesta.status, datos: JSON.parse(texto) as unknown };
    } catch {
      return { estado: respuesta.status, datos: undefined };
    }
  } catch {
    return { falla: "SERVICIO_NO_DISPONIBLE" };
  } finally {
    clearTimeout(plazo);
  }
}

function leerPedido(crudo: Crudo): PedidoAnalisis {
  if ("falla" in crudo) return fallo(crudo.falla);
  const { estado, datos } = crudo;
  if (estado === 202) {
    return esObjetoPlano(datos) && datos.estado === "ACEPTADO" && (datos.lugar === "EN_CURSO" || datos.lugar === "EN_ESPERA") ? Object.freeze({ ok: true, lugar: datos.lugar }) : INVALIDA;
  }
  if (estado === 401) return fallo("SERVICIO_TOKEN");
  if (estado === 403) return fallo("ANALISIS_APAGADO");
  if (estado === 409) return fallo("TAREA_INACTIVA");
  if (estado === 429) {
    if (!esObjetoPlano(datos)) return INVALIDA;
    if (datos.error === "OCUPADO") return fallo("OCUPADO");
    return datos.error === "ESPERA_MINIMA" && esSegundos(datos.reintentarEnS) ? fallo("ESPERA_MINIMA", datos.reintentarEnS) : INVALIDA;
  }
  return fallo("SERVICIO_NO_DISPONIBLE");
}

function leerEstado(crudo: Crudo): LecturaEstado {
  if ("falla" in crudo) return fallo(crudo.falla);
  const { estado, datos } = crudo;
  if (estado === 401) return fallo("SERVICIO_TOKEN");
  if (estado !== 200) return fallo("SERVICIO_NO_DISPONIBLE");
  if (!esObjetoPlano(datos)) return INVALIDA;
  const { enCurso, enEspera, reintentarEnS, ultimo } = datos;
  const ultimoValido = ultimo === null || (esObjetoPlano(ultimo) && esTarea(ultimo.tarea) && typeof ultimo.estado === "string" && PATRON_ESTADO.test(ultimo.estado));
  const valido = (enCurso === null || esTarea(enCurso)) && (enEspera === null || esTarea(enEspera)) && esSegundos(reintentarEnS) && ultimoValido;
  if (!valido) return INVALIDA;
  const ult = ultimo === null ? null : Object.freeze({ tarea: (ultimo as { tarea: TareaIa }).tarea, estado: (ultimo as { estado: string }).estado });
  return Object.freeze({ ok: true, estado: Object.freeze({ enCurso: enCurso as TareaIa | null, enEspera: enEspera as TareaIa | null, reintentarEnS, ultimo: ult }) });
}

/** El cliente que le pide al servicio inv-008-ia, con el `fetch` inyectado (el global de Node es asignable). */
export function clienteAnalisis(buscar: BuscarServicio, token: string, origen: string): ClienteAnalisis {
  return Object.freeze({
    async pedir(tarea: TareaIa): Promise<PedidoAnalisis> {
      return leerPedido(await pedirAlServicio(buscar, token, origen, RUTA_ANALIZAR, JSON.stringify({ tarea })));
    },
    async estado(): Promise<LecturaEstado> {
      return leerEstado(await pedirAlServicio(buscar, token, origen, RUTA_ESTADO_ANALISIS, "{}"));
    },
  });
}

/** El cliente del entorno de la app, o null si falta el token (o no tiene la forma) o la dirección no vale: no se manda nada. */
export function clienteAnalisisDelEntorno(entorno: Readonly<Record<string, string | undefined>>): ClienteAnalisis | null {
  const token = entorno[VARIABLE_TOKEN_SERVICIO_IA];
  if (!tokenServicioValido(token)) return null;
  const origen = leerOrigenServicioIa(entorno);
  if (!origen.ok) return null;
  return clienteAnalisis((url, init) => globalThis.fetch(url, init) as ReturnType<BuscarServicio>, token, origen.origen);
}
