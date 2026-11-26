/**
 * `servicio-ia.mjs ahora`: la corrida diaria (corrida.ts) UNA vez, a mano, y sale. Se corre dentro del contenedor del
 * servicio (docs/despliegue/produccion.md, «El servicio de IA»), con el mismo cableado que el bucle (cableado.ts).
 * Las mismas reglas que la corrida programada:
 * - sin configuración o en «apagado», nada;
 * - si hoy (Colombia) no es día hábil en la BVC, no corre y lo dice. No hay `--forzar`: la programada tampoco corre
 *   esos días, y un resumen de un día sin rueda no tendría hechos nuevos;
 * - lo ya PUBLICADO con la misma clave queda YA_PUBLICADO, sin duplicar (lo decide corrida.ts);
 * - el Mac atiende un pedido a la vez (orden de PI), pero el turno (semáforo) es de cada proceso. Por eso no corre si
 *   el bucle del mismo contenedor está en plena corrida (su latido dice CORRIENDO), ni si la ranura programada de hoy
 *   cae dentro de lo que esta corrida puede durar (duracionMaximaMs). No cubre un «Identificar» o «Probar» de la app
 *   que llegue justo en ese momento: ese pedido se cruzaría con uno de esta corrida.
 * Reintentos (REINTENTOS_AHORA): uno solo, con una pausa corta, en vez de los 3 de 5 min de la programada: quien lo
 * corre está mirando la consola y puede volver a correrlo.
 * Salida por consola: una línea por tarea con su estado, sin cifras. Código: 0 si todas terminaron (o no había nada que
 * hacer); 1 si alguna quedó en ERROR o FALLIDO, si se cruzaría con el bucle o si algo falló (con su código).
 * Conexiones: el rol inv_ia admite 2 y el bucle puede tener las suyas abiertas; esta corrida usa una (conUnaConexion).
 * Si la base no se la da, lo dice con el código y sale con 1: se vuelve a correr en unos minutos.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ConfigIaVigente } from "../ia/config/leer";
import { TIPOS_RESUMEN } from "../ia/contrato";
import { ARCHIVO_BUCLE, leerClaveValor } from "../servicio-precios/estado";
import { SALIDA } from "./bucle";
import { codigoDeError, type EstadoTipo, type PoliticaReintentos, type ResumenCorrida } from "./corrida";
import { ranuraDeHoy } from "./programa";

/** Un reintento, con medio minuto de pausa (el Ollama puede estar cargando el modelo). */
export const REINTENTOS_AHORA: PoliticaReintentos = Object.freeze({ maximo: 1, pausaMs: 30_000 });

/** Los estados con los que una tarea NO terminó: dan salida distinta de 0. */
const SIN_TERMINAR: ReadonlySet<EstadoTipo> = new Set<EstadoTipo>(["ERROR", "FALLIDO"]);
/** Los códigos de Prisma de «no hubo conexión»: no se alcanzó la base, se agotó la espera del pool o hay demasiadas. */
const SIN_CONEXION: ReadonlySet<string> = new Set(["P1001", "P1017", "P2024", "P2037"]);

export interface DependenciasAhora {
  readonly registrar: (mensaje: string) => void;
  /** La fecha de negocio de hoy en Colombia (a medianoche UTC). */
  readonly hoy: () => Date;
  /** El instante actual (ms Unix): para no cruzarse con la ranura programada. */
  readonly instante: () => number;
  leerConfig(): Promise<ConfigIaVigente | null>;
  esHabil(hoy: Date): Promise<boolean>;
  /** ¿El bucle del servicio está en plena corrida diaria? */
  bucleCorriendo(): Promise<boolean>;
  correr(config: ConfigIaVigente, hoy: Date): Promise<ResumenCorrida>;
}

/** Lo más que puede durar esta corrida: cada tipo con su intento y su reintento al límite de la configuración, y la pausa. */
export function duracionMaximaMs(config: ConfigIaVigente): number {
  return TIPOS_RESUMEN.length * (1 + REINTENTOS_AHORA.maximo) * config.limiteSegundos * 1000 + REINTENTOS_AHORA.pausaMs;
}

/** La ranura programada de hoy si cae entre ahora y el fin más tardío de esta corrida; si no, null. */
function ranuraQueSeCruza(config: ConfigIaVigente, instante: number): Date | null {
  const ranura = ranuraDeHoy(new Date(instante), config.horaResumen);
  if (ranura === null) return null;
  const t = ranura.getTime();
  return t >= instante && t <= instante + duracionMaximaMs(config) ? ranura : null;
}

/** 0 si todas las tareas terminaron; 1 si alguna quedó en ERROR o FALLIDO. */
export function salidaDe(resumen: ResumenCorrida): number {
  return Object.values(resumen.porTipo).some((e) => e !== undefined && SIN_TERMINAR.has(e)) ? SALIDA.FALLO : SALIDA.BIEN;
}

/** Lee el latido del bucle (`<dir>/bucle`): true solo si dice CORRIENDO. Sin el archivo (otro contenedor), false. */
export async function bucleEnCurso(dir: string): Promise<boolean> {
  try {
    return leerClaveValor(await readFile(path.join(dir, ARCHIVO_BUCLE), "utf8")).estado === "CORRIENDO";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * La URL de la base con `connection_limit=1`: el rol inv_ia tiene CONNECTION LIMIT 2 y el bucle del contenedor ya
 * tiene abiertas las suyas. Recibe una URL ya revisada (revisarCredencialIa); no la devuelve en ningún mensaje.
 */
export function conUnaConexion(url: string): string {
  const u = new URL(url);
  u.searchParams.set("connection_limit", "1");
  return u.toString();
}

async function correrSiToca(deps: DependenciasAhora): Promise<number> {
  const config = await deps.leerConfig();
  if (config === null || config.modo === "apagado") {
    deps.registrar("la IA está apagada (sin configuración o en modo apagado): no se hace nada");
    return SALIDA.BIEN;
  }
  const hoy = deps.hoy();
  if (!(await deps.esHabil(hoy))) {
    deps.registrar("hoy no es día hábil en la BVC: no hay resumen");
    return SALIDA.BIEN;
  }
  if (ranuraQueSeCruza(config, deps.instante()) !== null) {
    deps.registrar(`la corrida programada de las ${config.horaResumen} empezaría mientras esta corre: no se corren dos a la vez; córrala después de esa hora`);
    return SALIDA.FALLO;
  }
  if (await deps.bucleCorriendo()) {
    deps.registrar("el bucle del servicio tiene la corrida diaria en curso: no se corre otra a la vez; inténtelo cuando termine");
    return SALIDA.FALLO;
  }
  deps.registrar(`corrida a mano empieza (configuración v${config.version}, modo ${config.modo})`);
  const resumen = await deps.correr(config, hoy);
  const estados = Object.entries(resumen.porTipo);
  if (estados.length === 0) deps.registrar(`sin tareas: ${resumen.estado}`);
  for (const [tipo, estado] of estados) deps.registrar(`${tipo}: ${estado}`);
  return salidaDe(resumen);
}

/** La corrida a mano: lo que toque según la configuración y el día, y el código de salida. */
export async function correrAhora(deps: DependenciasAhora): Promise<number> {
  try {
    return await correrSiToca(deps);
  } catch (error) {
    const codigo = codigoDeError(error);
    const porque = SIN_CONEXION.has(codigo) ? " (la base no dio la conexión: las 2 conexiones del rol inv_ia pueden estar en uso por el bucle; vuelva a correrlo en unos minutos)" : "";
    deps.registrar(`la corrida a mano no se pudo hacer: ${codigo}${porque}`);
    return SALIDA.FALLO;
  }
}
