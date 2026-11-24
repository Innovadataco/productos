/**
 * Cableado real del servicio inv-008-ia (lo usa entrada.ts, el bundle de la imagen de la app): la base como inv_ia, el
 * `fetch` acotado hacia el Ollama del Mac, UN turno para todo lo que va al Mac (la corrida diaria y los pedidos a
 * demanda: un pedido a la vez), el bucle y el endpoint interno.
 * - Sin la credencial: solo el latido (EN ESPERA). Sin el token: sin endpoint (la corrida diaria sí corre).
 * - La nube queda apagada: el servicio no recibe su llave (el compose no se la pasa) y su `fetch` solo llega a la tailnet.
 * - El destino del Ollama sale SIEMPRE de config_ia (la base): no hay variable ni literal con él.
 */
import { PrismaClient } from "@prisma/client";
import { generadoresDeConfig } from "../ia/config/cableado";
import { leerGastoNube } from "../ia/config/gasto";
import { leerConfigIa, type ConfigIaVigente } from "../ia/config/leer";
import { usaLocal } from "../ia/config/parametros";
import { sondaDirecta } from "../ia/config/sonda-ollama";
import { PUERTO_SERVICIO_IA, VARIABLE_TOKEN_SERVICIO_IA } from "../ia/config/sonda-servicio";
import type { TipoResumen } from "../ia/contrato";
import { exportarHechos } from "../ia/evaluacion/exportar/exportar";
import { RUTAS_LOCALES, leerDestinoLocal } from "../ia/local/destino";
import type { BuscarLocal } from "../ia/local/http";
import { LISTA_MODELOS_PI, type ListaModelosPi } from "../ia/local/modelos";
import { OPCIONES_GENERACION } from "../ia/local/ollama";
import { crearSemaforo } from "../ia/local/semaforo";
import { registrarResumen, yaPublicado } from "../ia/registro/registro";
import { diaIso, esDiaHabil, fechaEnBogota } from "../precios/horario";
import { ESTADO_DIR_POR_DEFECTO } from "../servicio-precios/estado";
import { textoCot } from "../servicio-precios/programa";
import { iniciarBucle, type DependenciasBucle, type Programar, type Senales } from "./bucle";
import { leerTokenServicio, revisarCredencialIa } from "./configuracion";
import { correrDiaria, type DependenciasCorrida } from "./corrida";
import { crearAtencion, tokenAutorizado } from "./pedidos";
import { crearServidor } from "./servidor";

/** Lo que el servicio usa del proceso de node (process, o uno falso en las pruebas). */
export interface Proceso extends Senales {
  readonly env: NodeJS.ProcessEnv;
  readonly stdout: { write(texto: string): unknown };
}

export const VARIABLE_ESTADO_DIR = "IA_ESTADO_DIR";

/**
 * El `fetch` del servicio: solo `http://<IPv4 de la tailnet>:<puerto>` con /api/tags o /api/generate (las mismas reglas
 * de la puerta local, otra vez). Cualquier otra dirección se rechaza sin salir a la red.
 */
export function fetchAcotado(real: BuscarLocal): BuscarLocal {
  return async (url, init) => {
    const ruta = RUTAS_LOCALES.find((r) => typeof url === "string" && url.endsWith(r));
    try {
      if (ruta === undefined) throw new Error("ruta");
      leerDestinoLocal(url.slice(0, -ruta.length));
    } catch {
      throw new Error("DESTINO_NO_PERMITIDO");
    }
    return real(url, init);
  };
}

/** El digest (de la lista de PI) con el que la local publicaría esa tarea: la clave de «ya publicado». */
export function digestsDe(config: ConfigIaVigente, tarea: TipoResumen, lista: ListaModelosPi): readonly string[] {
  const modelo = config.tareas[tarea].modeloLocal;
  if (!usaLocal(config.modo) || modelo === null || lista.estado !== "LISTA") return [];
  const digest = lista.modelos.find((m) => m.nombre === modelo)?.digest ?? null;
  return digest === null ? [] : [digest];
}

/** Las opciones del pedido que quedan en el registro (enteros: la temperatura, en centésimas). */
export function opcionesDe(config: ConfigIaVigente): Readonly<Record<string, unknown>> {
  return Object.freeze({ num_ctx: OPCIONES_GENERACION.num_ctx, seed: OPCIONES_GENERACION.seed, temperaturaCentesimas: config.temperaturaCentesimas });
}

const programarConIntervalo: Programar = (accion, cadaMs) => {
  const intervalo = setInterval(accion, cadaMs);
  return () => clearInterval(intervalo);
};
const hoyEnColombia = (): string => diaIso(fechaEnBogota(new Date()));

/** `servicio-ia.mjs bucle`: el servicio permanente. `fetchReal` es el `fetch` de node, tomado antes de anularlo. */
export function servir(proceso: Proceso, fetchReal: BuscarLocal, crearDb: () => PrismaClient = () => new PrismaClient()): Promise<number> {
  const registrar = (mensaje: string): void => void proceso.stdout.write(`${textoCot(new Date())} [ia] ${mensaje}\n`);
  const credencial = revisarCredencialIa(proceso.env.DATABASE_URL);
  const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const base = { dir: proceso.env[VARIABLE_ESTADO_DIR] || ESTADO_DIR_POR_DEFECTO, ahora: Date.now, registrar, credencial, programar: programarConIntervalo };
  const sinBase = (): Promise<never> => Promise.reject(new Error("SIN_CREDENCIAL"));
  if (!credencial.ok) return iniciarBucle({ ...base, leerConfig: sinBase, esHabil: sinBase, correr: sinBase, esperar }, proceso);

  const db = crearDb();
  const semaforo = crearSemaforo();
  const fetchLocal = fetchAcotado(fetchReal);
  const leerConfig = (): Promise<ConfigIaVigente | null> => leerConfigIa(db);
  const corrida: DependenciasCorrida = {
    exportar: (hoy) => exportarHechos(db, hoy),
    generadores: (config, tarea) => generadoresDeConfig(config, tarea, {}, { fetchLocal, gastoDelMes: leerGastoNube(db, hoyEnColombia), semaforo }),
    digests: (config, tarea) => digestsDe(config, tarea, LISTA_MODELOS_PI),
    opciones: opcionesDe,
    yaPublicado: (clave) => yaPublicado(db, clave),
    registrar: (entrada) => registrarResumen(db, entrada),
    esperar,
    registrarLog: registrar,
  };
  const deps: DependenciasBucle = {
    ...base,
    leerConfig,
    esHabil: async (hoy) => {
      const festivos = await db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } });
      return esDiaHabil(hoy, new Set(festivos.map((f) => diaIso(f.dia))));
    },
    correr: (config, hoy) => correrDiaria(corrida, config, hoy),
    esperar,
  };

  const token = leerTokenServicio(proceso.env[VARIABLE_TOKEN_SERVICIO_IA]);
  const servidor = token.ok ? crearServidor(crearAtencion({ token: token.token, leerConfig, sonda: sondaDirecta(fetchLocal, semaforo) }), (a) => tokenAutorizado(a, token.token)) : null;
  if (!token.ok) registrar(token.motivo);
  if (LISTA_MODELOS_PI.estado !== "LISTA") registrar(`sin lista de PI de modelos permitidos (${LISTA_MODELOS_PI.motivo}): la puerta local no puede generar`);
  servidor?.on("error", (error) => registrar(`el endpoint interno falló: ${(error as NodeJS.ErrnoException).code ?? "ERROR"}`));
  servidor?.listen(PUERTO_SERVICIO_IA, "0.0.0.0", () => registrar(`endpoint interno listo en el puerto ${PUERTO_SERVICIO_IA} (solo la red interna, con token)`));

  return iniciarBucle(deps, proceso, async () => {
    servidor?.close();
    servidor?.closeAllConnections();
    await db.$disconnect();
  });
}
