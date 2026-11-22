import "server-only";
/**
 * Lo que manda el formulario de /edicion/ia, leído en el servidor (E8). Claves exactas (ni una de más: nada de llaves,
 * autores ni destinos de prueba), cada campo con su forma y su lista cerrada, y las reglas de cada modo. La lista de
 * modelos locales es la que publica PI (se inyecta): sin ella no se puede elegir ningún modelo local. Los errores
 * llevan solo el campo y un código, nunca el valor. Pura: la escritura es de `crearVersionConfigIa`.
 *
 * El destino del Ollama: aquí se revisa solo el FORMATO del destino (`leerDestinoLocal`: una IPv4 de la tailnet y un
 * puerto; sin nombres, ni bucle local, ni rangos privados o públicos). NO es el control de seguridad: el rango incluye
 * cualquier equipo de la tailnet. El control está en la red (la regla de salida de PI y la ACL de Tailscale).
 */
import { Errores, numeroDeVersion, objetoConClaves } from "@/plan/edicion/comun";
import { esDe } from "../formas";
import { leerDestinoLocal } from "../local/destino";
import { ErrorLocal } from "../local/errores";
import type { ListaModelosPi } from "../local/modelos";
import { ESFUERZOS_NUBE, MODELOS_NUBE, type EsfuerzoNube, type ModeloNube } from "../nube/peticion";
import { MODOS_PUERTAS, type ModoPuertas } from "../puertas";
import type { ErrorCampoConfig } from "./errores";
import {
  HORAS_RESUMEN, LIMITE_MAX_S, LIMITE_MIN_S, MAX_LARGO_MOTIVO_CONFIG, TAREAS_IA, TEMPERATURA_MAX_CENTESIMAS, TOPE_MAX_MICRO_USD, TOPE_MIN_MICRO_USD, usaLocal, usaNube,
  type HoraResumen, type TareaIa,
} from "./parametros";

export interface TareaConfig {
  readonly activo: boolean;
  readonly modeloLocal: string | null;
}
export type TareasConfig = Readonly<Record<TareaIa, TareaConfig>>;

/** Una configuración nueva, ya revisada (lo que se guarda, sin la versión ni el autor). */
export interface EntradaConfigIa {
  readonly modo: ModoPuertas;
  readonly ollamaHost: string | null;
  readonly ollamaPuerto: number | null;
  readonly temperaturaCentesimas: number;
  readonly tareas: TareasConfig;
  readonly modeloNube: ModeloNube;
  readonly esfuerzoNube: EsfuerzoNube;
  readonly topeMicroUsd: bigint | null;
  readonly horaResumen: HoraResumen;
  readonly limiteSegundos: number;
  readonly motivo: string;
}

export type LecturaConfig =
  | { readonly ok: true; readonly versionBase: number; readonly valor: EntradaConfigIa }
  | { readonly ok: false; readonly errores: readonly ErrorCampoConfig[] };

/** Un motivo largo en UTF-8 (hasta 4 bytes por carácter) más lo demás (claves, listas, números) con holgura. */
export const MAX_CUERPO_CONFIG_IA = MAX_LARGO_MOTIVO_CONFIG * 4 + 2048;

const CLAVES = Object.freeze(["versionBase", "modo", "ollamaHost", "ollamaPuerto", "temperatura", "tareas", "modeloNube", "esfuerzoNube", "topeMensualUsd", "horaResumen", "limiteSegundos", "motivo"]);
const CLAVES_TAREA = Object.freeze(["activo", "modeloLocal"]);
const PUERTO = /^[1-9][0-9]{0,4}$/;
const MAX_PUERTO = 65_535;
const TEMPERATURA = /^([01])(?:[.,]([0-9]{1,2}))?$/;
const USD = /^([0-9]{1,2})(?:[.,]([0-9]{1,2}))?$/;
const ENTERO = /^[0-9]{1,3}$/;
const MICRO_USD_POR_CENTAVO = 10_000n;
const NULO = "\u0000";

const vacio = (v: unknown): boolean => v === null || v === "";

function enumerado<T extends string>(e: Errores, campo: string, lista: readonly T[], v: unknown, codigo: string): T | undefined {
  return esDe(lista, v) ? v : e.anotar(campo, codigo);
}

function motivo(e: Errores, v: unknown): string | undefined {
  if (typeof v !== "string" || v.includes(NULO)) return e.anotar("motivo", "FORMATO_INVALIDO");
  if (v.trim() === "") return e.anotar("motivo", "VACIO");
  return v.length > MAX_LARGO_MOTIVO_CONFIG ? e.anotar("motivo", "DEMASIADO_LARGO") : v;
}

function temperatura(e: Errores, v: unknown): number | undefined {
  const m = typeof v === "string" ? TEMPERATURA.exec(v) : null;
  const centesimas = m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) : Number.NaN;
  return centesimas <= TEMPERATURA_MAX_CENTESIMAS ? centesimas : e.anotar("temperatura", "TEMPERATURA_INVALIDA");
}

function limite(e: Errores, v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && ENTERO.test(v) ? Number(v) : Number.NaN;
  return Number.isInteger(n) && n >= LIMITE_MIN_S && n <= LIMITE_MAX_S ? n : e.anotar("limiteSegundos", "LIMITE_INVALIDO");
}

/** El tope en micro-USD; null si viene vacío; undefined (con su error) si no se lee o no está en el rango. */
function tope(e: Errores, v: unknown): bigint | null | undefined {
  if (vacio(v)) return null;
  const m = typeof v === "string" ? USD.exec(v) : null;
  if (m === null) return e.anotar("topeMensualUsd", "TOPE_INVALIDO");
  const micro = BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? "").padEnd(2, "0")) * MICRO_USD_POR_CENTAVO;
  return micro >= TOPE_MIN_MICRO_USD && micro <= TOPE_MAX_MICRO_USD ? micro : e.anotar("topeMensualUsd", "TOPE_FUERA_DE_RANGO");
}

type Destino = { readonly host: string | null; readonly puerto: number | null };

function puerto(e: Errores, v: unknown): number | null | undefined {
  if (vacio(v)) return null;
  const texto = typeof v === "number" ? String(v) : v;
  if (typeof texto !== "string" || !PUERTO.test(texto) || Number(texto) > MAX_PUERTO) return e.anotar("ollamaPuerto", "DESTINO_INVALIDO");
  return Number(texto);
}

/** El formato del destino (no es el control de seguridad: ver la cabecera). */
function destino(e: Errores, host: unknown, v: unknown): Destino | undefined {
  if (host !== null && typeof host !== "string") return e.anotar("ollamaHost", "FORMATO_INVALIDO");
  const p = puerto(e, v);
  if (p === undefined) return undefined;
  const h = vacio(host) ? null : (host as string);
  if (h === null && p === null) return { host: null, puerto: null };
  if (h === null) return e.anotar("ollamaHost", "DESTINO_INCOMPLETO");
  if (p === null) return e.anotar("ollamaPuerto", "DESTINO_INCOMPLETO");
  try {
    leerDestinoLocal(`http://${h}:${p}`);
  } catch (error) {
    const fuera = error instanceof ErrorLocal && error.codigo === "DESTINO_FUERA_DE_RANGO";
    return e.anotar("ollamaHost", fuera ? "DESTINO_FUERA_DE_FORMATO" : "DESTINO_INVALIDO");
  }
  return { host: h, puerto: p };
}

const nombresDe = (lista: ListaModelosPi): ReadonlySet<string> => new Set(lista.estado === "LISTA" ? lista.modelos.map((m) => m.nombre) : []);

function tarea(e: Errores, t: TareaIa, v: unknown, lista: ListaModelosPi): TareaConfig | undefined {
  const r = objetoConClaves(v, CLAVES_TAREA);
  const modelo = r?.modeloLocal;
  if (r === null || typeof r.activo !== "boolean" || !(modelo === null || typeof modelo === "string")) return e.anotar("tareas", "FORMATO_INVALIDO");
  const modeloLocal = vacio(modelo) ? null : (modelo as string);
  const campo = `tareas.${t}.modeloLocal`;
  if (modeloLocal !== null && lista.estado !== "LISTA") return e.anotar(campo, "SIN_LISTA_DE_PI");
  if (modeloLocal !== null && !nombresDe(lista).has(modeloLocal)) return e.anotar(campo, "MODELO_FUERA_DE_LISTA");
  return Object.freeze({ activo: r.activo, modeloLocal });
}

function tareas(e: Errores, v: unknown, lista: ListaModelosPi): TareasConfig | undefined {
  const r = objetoConClaves(v, TAREAS_IA);
  if (r === null) return e.anotar("tareas", "FORMATO_INVALIDO");
  const leidas = TAREAS_IA.map((t) => [t, tarea(e, t, r[t], lista)] as const);
  if (leidas.some(([, x]) => x === undefined)) return undefined;
  return Object.freeze(Object.fromEntries(leidas) as Record<TareaIa, TareaConfig>);
}

/** Las reglas de cada modo: con la local, la lista de PI, el destino y un modelo por tarea activa; con la nube, el tope. */
function reglasDelModo(e: Errores, v: Partial<EntradaConfigIa>, lista: ListaModelosPi, topeLeido: boolean): void {
  if (v.modo === undefined) return;
  if (usaLocal(v.modo)) {
    if (lista.estado !== "LISTA") e.anotar("modo", "SIN_LISTA_DE_PI");
    if (v.ollamaHost === null) e.anotar("ollamaHost", "DESTINO_FALTA");
    for (const t of TAREAS_IA) if (v.tareas?.[t].activo === true && v.tareas[t].modeloLocal === null) e.anotar(`tareas.${t}.modeloLocal`, "MODELO_LOCAL_FALTA");
  }
  if (usaNube(v.modo) && topeLeido && v.topeMicroUsd === null) e.anotar("topeMensualUsd", "TOPE_FALTA");
}

/** Lee el cuerpo del formulario contra la lista de PI. Pura y sin excepciones. */
export function leerPedidoConfig(cuerpo: unknown, lista: ListaModelosPi): LecturaConfig {
  const r = objetoConClaves(cuerpo, CLAVES);
  if (r === null) return { ok: false, errores: [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }] };
  const e = new Errores();
  const versionBase = numeroDeVersion(e, "versionBase", r.versionBase);
  const d = destino(e, r.ollamaHost, r.ollamaPuerto);
  const topeMicroUsd = tope(e, r.topeMensualUsd);
  const parcial: Partial<EntradaConfigIa> = {
    modo: enumerado(e, "modo", MODOS_PUERTAS, r.modo, "MODO_INVALIDO"),
    ollamaHost: d?.host, ollamaPuerto: d?.puerto,
    temperaturaCentesimas: temperatura(e, r.temperatura),
    tareas: tareas(e, r.tareas, lista),
    modeloNube: enumerado(e, "modeloNube", MODELOS_NUBE, r.modeloNube, "MODELO_NUBE_INVALIDO"),
    esfuerzoNube: enumerado(e, "esfuerzoNube", ESFUERZOS_NUBE, r.esfuerzoNube, "ESFUERZO_INVALIDO"),
    topeMicroUsd,
    horaResumen: enumerado(e, "horaResumen", HORAS_RESUMEN, r.horaResumen, "HORA_INVALIDA"),
    limiteSegundos: limite(e, r.limiteSegundos),
    motivo: motivo(e, r.motivo),
  };
  reglasDelModo(e, parcial, lista, topeMicroUsd !== undefined);
  if (e.hay || versionBase === undefined) return { ok: false, errores: Object.freeze([...e.lista]) };
  return { ok: true, versionBase, valor: Object.freeze(parcial as EntradaConfigIa) };
}
