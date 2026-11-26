/**
 * `servicio-ia.mjs ahora`: la corrida diaria (corrida.ts) UNA vez, a mano, y sale. Se corre dentro del contenedor del
 * servicio (docs/despliegue/produccion.md, «El servicio de IA»), con el mismo cableado que el bucle (cableado.ts).
 * Las mismas reglas que la corrida programada:
 * - sin configuración o en «apagado», nada;
 * - si hoy (Colombia) no es día hábil en la BVC, no corre y lo dice. No hay `--forzar`: la programada tampoco corre
 *   esos días, y un resumen de un día sin rueda no tendría hechos nuevos;
 * - lo ya PUBLICADO con la misma clave queda YA_PUBLICADO, sin duplicar (lo decide corrida.ts);
 * - si el bucle del mismo contenedor está en plena corrida (su latido dice CORRIENDO), no corre otra a la vez: el Mac
 *   atiende un pedido a la vez (orden de PI). El turno (semáforo) es de cada proceso; este control cubre la diaria,
 *   no un «Identificar» o «Probar» de la app que llegue justo en ese momento.
 * Reintentos (REINTENTOS_AHORA): uno solo, con una pausa corta, en vez de los 3 de 5 min de la programada: quien lo
 * corre está mirando la consola y puede volver a correrlo.
 * Salida por consola: una línea por tarea con su estado, sin cifras. Código: 0 si todas terminaron (o no había nada que
 * hacer); 1 si alguna quedó en ERROR o FALLIDO, si el bucle estaba corriendo o si algo falló (con su código).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ConfigIaVigente } from "../ia/config/leer";
import { ARCHIVO_BUCLE, leerClaveValor } from "../servicio-precios/estado";
import { SALIDA } from "./bucle";
import { codigoDeError, type EstadoTipo, type PoliticaReintentos, type ResumenCorrida } from "./corrida";

/** Un reintento, con medio minuto de pausa (el Ollama puede estar cargando el modelo). */
export const REINTENTOS_AHORA: PoliticaReintentos = Object.freeze({ maximo: 1, pausaMs: 30_000 });

/** Los estados con los que una tarea NO terminó: dan salida distinta de 0. */
const SIN_TERMINAR: ReadonlySet<EstadoTipo> = new Set<EstadoTipo>(["ERROR", "FALLIDO"]);

export interface DependenciasAhora {
  readonly registrar: (mensaje: string) => void;
  /** La fecha de negocio de hoy en Colombia (a medianoche UTC). */
  readonly hoy: () => Date;
  leerConfig(): Promise<ConfigIaVigente | null>;
  esHabil(hoy: Date): Promise<boolean>;
  /** ¿El bucle del servicio está en plena corrida diaria? */
  bucleCorriendo(): Promise<boolean>;
  correr(config: ConfigIaVigente, hoy: Date): Promise<ResumenCorrida>;
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
    deps.registrar(`la corrida a mano no se pudo hacer: ${codigoDeError(error)}`);
    return SALIDA.FALLO;
  }
}
