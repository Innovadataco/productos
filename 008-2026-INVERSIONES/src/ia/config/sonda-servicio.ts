import "server-only";
/**
 * La sonda de la app hacia el servicio inv-008-ia (E6, D-026): «Identificar modelos» y «Probar» de /edicion/ia (y, más
 * adelante, el chat). La app NO tiene salida a internet ni a la tailnet: le pide al servicio interno, que es el único que
 * llega al Ollama del Mac.
 * - La dirección del servicio sale de configuración (`INV_IA_SERVICIO_URL`; por omisión `http://inv-008-ia:8008`, el
 *   nombre del servicio en la red interna del compose) y se VALIDA (`leerOrigenServicioIa`): http, sin usuario ni ruta, un
 *   solo nombre de servicio (sin puntos: ni dominios ni IP de internet; en producción, solo `inv-008-ia`) y un puerto alto. Nunca sale del pedido: no hay a
 *   dónde desviarlo (sin SSRF). Sin rutas fijas de PI en el código (decisión de Jelk del 26-nov: se separa de PI).
 * - El token compartido (`INV_IA_SERVICIO_TOKEN`, del archivo de producción) va en `authorization: Bearer`.
 * - El destino del Ollama NO viaja: el servicio usa el GUARDADO en config_ia, y la temperatura y el límite guardados.
 *   De «Probar» solo viaja el nombre del modelo, que el servicio coteja contra las tareas activas de la configuración.
 * - Nada lanza: el servicio caído o en espera es «inalcanzable»; una respuesta con otra forma se descarta. No se confía
 *   en lo que responde: se copian solo los campos del contrato, ya revisados.
 */
import { esObjetoPlano } from "../formas";
import { MAX_LARGO_DETALLE, PATRON_DETALLE, PATRON_MODELO } from "../generador";
import type { ModeloInstalado } from "../local/identificar";
import type { IdentificacionCruda, PruebaCruda, SondaOllama } from "./sonda-ollama";

export const VARIABLE_TOKEN_SERVICIO_IA = "INV_IA_SERVICIO_TOKEN";
/** El nombre del servicio en el compose (su nombre DNS en la red interna) y su puerto, que no se publica. */
export const HOST_SERVICIO_IA = "inv-008-ia";
export const PUERTO_SERVICIO_IA = 8008;
export const ORIGEN_SERVICIO_IA = `http://${HOST_SERVICIO_IA}:${PUERTO_SERVICIO_IA}`;
export const RUTA_IDENTIFICAR = "/identificar";
export const RUTA_PROBAR = "/probar";
/** El botón «Analizar con IA»: pedir el análisis de una tarea y leer el estado (analisis-servicio.ts). */
export const RUTA_ANALIZAR = "/analizar";
export const RUTA_ESTADO_ANALISIS = "/estado-analisis";
/** La dirección del servicio de IA para la app (opcional: sin ella, la de siempre). */
export const VARIABLE_ORIGEN_SERVICIO_IA = "INV_IA_SERVICIO_URL";
/** El nombre del servicio en la red interna: una sola etiqueta DNS (sin puntos, sin IP). */
const NOMBRE_SERVICIO = /^[a-z][a-z0-9-]{0,62}$/;
const PUERTO_MIN = 1024;
const PUERTO_MAX = 65_535;
const BUCLE_LOCAL = "127.0.0.1";

export type OrigenLeido = { readonly ok: true; readonly origen: string } | { readonly ok: false; readonly motivo: string };

/**
 * La dirección del servicio de IA de la configuración, revisada: `http://<nombre>:<puerto>` y nada más (sin usuario, ruta,
 * consulta ni ancla). Un solo nombre de servicio (sin puntos), un puerto de 1024 a 65535 escrito, y el bucle local
 * (127.0.0.1) solo fuera de producción, para las pruebas con un servicio falso. En producción, el host es solo
 * `inv-008-ia` (lista cerrada). Si no cuadra, no se usa (el motivo no
 * repite el valor: podría traer una clave).
 */
export function leerOrigenServicioIa(entorno: Readonly<Record<string, string | undefined>>): OrigenLeido {
  const valor = entorno[VARIABLE_ORIGEN_SERVICIO_IA];
  if (valor === undefined || valor === "") return { ok: true, origen: ORIGEN_SERVICIO_IA };
  const invalida = (porque: string): OrigenLeido => ({ ok: false, motivo: `${VARIABLE_ORIGEN_SERVICIO_IA} no es válida (${porque})` });
  if (valor !== valor.trim()) return invalida("tiene espacios");
  let u: URL;
  try {
    u = new URL(valor);
  } catch {
    return invalida("no es una dirección");
  }
  if (u.protocol !== "http:") return invalida("no es http");
  if (u.username !== "" || u.password !== "") return invalida("trae usuario");
  if (u.pathname !== "/" || u.search !== "" || u.hash !== "") return invalida("trae ruta, consulta o ancla");
  const puerto = Number(u.port);
  if (u.port === "" || !Number.isInteger(puerto) || puerto < PUERTO_MIN || puerto > PUERTO_MAX) return invalida("el puerto");
  const bucleLocal = u.hostname === BUCLE_LOCAL && entorno.NODE_ENV !== "production";
  if (!bucleLocal && !NOMBRE_SERVICIO.test(u.hostname)) return invalida("el nombre");
  if (!bucleLocal && u.hostname === "localhost") return invalida("el nombre");
  // En producción, lista cerrada: solo el servicio del compose. Otro nombre de una sola etiqueta (la base, la app, un alias
  // como ip6-localhost) llevaría el token compartido a quien no es.
  if (entorno.NODE_ENV === "production" && u.hostname !== HOST_SERVICIO_IA) return invalida("el nombre");
  return { ok: true, origen: `http://${u.hostname}:${u.port}` };
}

const motivosAvisados = new Set<string>();

/** Solo para las pruebas: vuelve a avisar. */
export function reiniciarAvisosOrigenParaPruebas(): void {
  motivosAvisados.clear();
}

/** Deja una línea con el MOTIVO de una dirección inválida (nunca el valor), una vez por motivo y no una por pedido. */
export function avisarOrigenInvalido(motivo: string): void {
  if (motivosAvisados.has(motivo)) return;
  motivosAvisados.add(motivo);
  console.error(`[ia-servicio] ${motivo}: no se usa y la app queda sin conexión con el servicio de IA`);
}
/** 32 bytes al azar en base64url son 43 caracteres: ese es el mínimo. */
export const PATRON_TOKEN_SERVICIO = /^[A-Za-z0-9_-]{43,128}$/;
/** Identificar es un /api/tags en el Mac (10 s) más el viaje. */
export const LIMITE_IDENTIFICAR_SERVICIO_MS = 15_000;
/** Lo que se le suma al límite guardado de «Probar» para el viaje y el turno. */
export const HOLGURA_PROBAR_MS = 5_000;
export const MAX_RESPUESTA_SERVICIO = 262_144;
const MAX_MODELOS = 1024;
const DIGEST = /^[0-9a-f]{64}$/;

export const tokenServicioValido = (valor: unknown): valor is string => typeof valor === "string" && PATRON_TOKEN_SERVICIO.test(valor);

export interface InitServicio {
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
  readonly redirect: "error";
}
/** El `fetch` inyectado (el global de Node es asignable). */
export type BuscarServicio = (url: string, init: InitServicio) => Promise<{ readonly status: number; text(): Promise<string> }>;

type Fallo = { readonly ok: false; readonly motivo: string; readonly detalle: string };
type Lectura = { readonly ok: true; readonly datos: unknown } | Fallo;

const fallo = (motivo: string, detalle: string): Fallo => Object.freeze({ ok: false, motivo, detalle });
const INVALIDA = fallo("ERROR_PROVEEDOR", "SERVICIO_IA_RESPUESTA_INVALIDA");
const DETALLE_DE_ESTADO: Readonly<Record<number, string>> = Object.freeze({ 401: "SERVICIO_IA_TOKEN", 429: "SERVICIO_IA_OCUPADO" });

const esCodigo = (valor: unknown): valor is string => typeof valor === "string" && valor.length <= MAX_LARGO_DETALLE && PATRON_DETALLE.test(valor);
const esLatencia = (valor: unknown): valor is number => typeof valor === "number" && Number.isFinite(valor) && valor >= 0;

async function pedir(buscar: BuscarServicio, token: string, origen: string, ruta: string, cuerpo: string, limiteMs: number): Promise<Lectura> {
  const control = new AbortController();
  const plazo = setTimeout(() => control.abort(), limiteMs);
  try {
    const respuesta = await buscar(`${origen}${ruta}`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" }, body: cuerpo,
      signal: control.signal, redirect: "error",
    });
    if (respuesta.status !== 200) return fallo("ERROR_PROVEEDOR", DETALLE_DE_ESTADO[respuesta.status] ?? "SERVICIO_IA_HTTP");
    const texto = await respuesta.text();
    if (texto.length > MAX_RESPUESTA_SERVICIO) return INVALIDA;
    return { ok: true, datos: JSON.parse(texto) as unknown };
  } catch (error) {
    if (control.signal.aborted) return fallo("TIEMPO_AGOTADO", "SERVICIO_IA_SIN_RESPUESTA");
    return error instanceof SyntaxError ? INVALIDA : fallo("MODELO_NO_DISPONIBLE", "SERVICIO_IA_INALCANZABLE");
  } finally {
    clearTimeout(plazo);
  }
}

function modeloDe(valor: unknown): ModeloInstalado | null {
  if (!esObjetoPlano(valor)) return null;
  const { nombre, tamanoBytes, digest } = valor;
  const valido = typeof nombre === "string" && PATRON_MODELO.test(nombre)
    && (tamanoBytes === null || (typeof tamanoBytes === "number" && Number.isSafeInteger(tamanoBytes) && tamanoBytes >= 0))
    && (digest === null || (typeof digest === "string" && DIGEST.test(digest)));
  return valido ? Object.freeze({ nombre, tamanoBytes, digest } as ModeloInstalado) : null;
}

function leerIdentificacion(datos: unknown): IdentificacionCruda {
  if (!esObjetoPlano(datos)) return INVALIDA;
  if (datos.ok === false) return esCodigo(datos.motivo) && esCodigo(datos.detalle) ? fallo(datos.motivo, datos.detalle) : INVALIDA;
  if (datos.ok !== true || !Array.isArray(datos.modelos) || datos.modelos.length > MAX_MODELOS) return INVALIDA;
  const modelos = (datos.modelos as readonly unknown[]).map(modeloDe);
  return modelos.every((m): m is ModeloInstalado => m !== null) ? Object.freeze({ ok: true, modelos: Object.freeze(modelos) }) : INVALIDA;
}

const pruebaFallida = (f: Fallo): PruebaCruda => Object.freeze({ ...f, etapa: "PING", latenciaMs: 0 });

function leerPrueba(datos: unknown): PruebaCruda {
  if (!esObjetoPlano(datos) || !esLatencia(datos.latenciaMs)) return pruebaFallida(INVALIDA);
  const latenciaMs = Math.round(datos.latenciaMs);
  if (datos.ok === true) return esCodigo(datos.smoke) ? Object.freeze({ ok: true, latenciaMs, smoke: datos.smoke }) : pruebaFallida(INVALIDA);
  const valido = datos.ok === false && esCodigo(datos.etapa) && esCodigo(datos.motivo) && esCodigo(datos.detalle);
  return valido ? Object.freeze({ ok: false, etapa: datos.etapa as string, motivo: datos.motivo as string, detalle: datos.detalle as string, latenciaMs }) : pruebaFallida(INVALIDA);
}

/** La sonda que le pide al servicio inv-008-ia. `destino`, la temperatura y el límite no viajan: el servicio usa lo guardado. */
export function sondaServicio(buscar: BuscarServicio, token: string, origen: string = ORIGEN_SERVICIO_IA): SondaOllama {
  return Object.freeze({
    tipo: "SERVICIO",
    async identificar(): Promise<IdentificacionCruda> {
      const r = await pedir(buscar, token, origen, RUTA_IDENTIFICAR, "{}", LIMITE_IDENTIFICAR_SERVICIO_MS);
      return r.ok ? leerIdentificacion(r.datos) : r;
    },
    async probar(_destino: string, modelo: string, _temperaturaCentesimas: number, limiteMs: number): Promise<PruebaCruda> {
      const r = await pedir(buscar, token, origen, RUTA_PROBAR, JSON.stringify({ modelo }), limiteMs + HOLGURA_PROBAR_MS);
      return r.ok ? leerPrueba(r.datos) : pruebaFallida(r);
    },
  });
}
