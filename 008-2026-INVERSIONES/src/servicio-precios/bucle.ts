/**
 * El bucle del servicio inv-008-precios (D-018) y la corrida a pedido (--ahora).
 * - Programa: de lunes a viernes a las 18:00 COT, una vez al día (programa.ts). Sin reintentos: si la corrida falla,
 *   la próxima es la del siguiente día hábil. Si el contenedor arranca después de las 18:00, la de ese día no se
 *   recupera (los CLI traen 10 días en cada corrida).
 * - Latido cada TIC_MS en /estado/bucle, también durante la corrida (la corrida no bloquea el tic): es el
 *   healthcheck y lo leerá el vigía.
 * - Sin el secreto (o con una credencial ajena) NO se cae: lo dice al arrancar, sigue con latido y en cada hora de
 *   corrida registra que la omitió. Si saliera, restart: always lo volvería a levantar y rompería el `up --wait`, la
 *   reanudación y la pausa de PI.
 * - Una corrida a la vez entre el bucle y un --ahora (corrida.candado): si está tomado, la de ese día se omite.
 * - Ninguna línea del log trae la URL de la base: la credencial ya llega revisada (configuracion.ts).
 * - Segunda ranura (opcional, `deps.intradia`): durante la rueda, un ciclo de precios intradía cada `cicloMs`, con su propio
 *   temporizador (intradia.ts). No cambia la corrida de las 18:00: esta espera a que termine un ciclo en curso y el ciclo
 *   no corre mientras la de las 18:00 está pendiente.
 */
import { leerArgumentosAhora, type Credencial } from "./configuracion";
import { hacerCorrida, type ResultadoCorrida } from "./corrida";
import { ARCHIVO_BUCLE, ARCHIVO_CANDADO, ARCHIVO_ULTIMA, CANDADO_VIEJO_MS, escribirAtomico, tomarCandado, type Campos } from "./estado";
import { crearIntradia } from "./intradia";
import type { ConfigIntradia } from "./intradia-configuracion";
import { proximaCorrida, textoCot } from "./programa";
import type { Corredor } from "./tareas";

export const TIC_MS = 60_000;
export const SALIDA = { BIEN: 0, FALLO: 1, USO: 2, AVISO: 3, CONFIGURACION: 64, OCUPADO: 75 } as const;

/** Repite `accion` cada `cadaMs`; devuelve con qué cancelarlo (setInterval, inyectable en las pruebas). */
export type Programar = (accion: () => void, cadaMs: number) => () => void;
export type Modo = "bucle" | "ahora";

export interface Dependencias {
  readonly dir: string;
  readonly ahora: () => number;
  readonly registrar: (mensaje: string) => void;
  readonly corredor: Corredor;
  readonly credencial: Credencial;
  readonly programar: Programar;
  readonly plazoMs?: number;
  /** La configuración del ciclo intradía (precios cada minuto). Sin ella, el bucle solo hace la corrida de las 18:00. */
  readonly intradia?: ConfigIntradia;
}

const segundos = (ms: number): number => Math.floor(ms / 1000);

/** El código de un error para el log (ENOENT, EACCES…), nunca su mensaje. */
export function codigoDeError(error: unknown): string {
  const codigo = (error as NodeJS.ErrnoException | null)?.code;
  if (typeof codigo === "string") return codigo;
  return error instanceof Error ? error.name : "ERROR";
}

/** Escribe un archivo de la huella; si no puede, lo registra (el servicio no se cae por eso). */
async function escribirHuella(deps: Dependencias, nombre: string, campos: Campos): Promise<void> {
  try {
    await escribirAtomico(deps.dir, nombre, campos);
  } catch (error) {
    deps.registrar(`no se pudo escribir la huella (${nombre}): ${codigoDeError(error)}`);
  }
}

/**
 * Una corrida con el candado y la huella de la última corrida. null si otra corrida tiene el candado (no se hace y
 * no se reintenta). Mientras corre, refresca el candado cada TIC_MS.
 */
export async function corridaRegistrada(deps: Dependencias, modo: Modo, desde: string | null): Promise<ResultadoCorrida | null> {
  const inicio = deps.ahora();
  // Lo viejo del candado se mide contra su mtime, que es del reloj del sistema: Date.now(), no el reloj inyectado.
  const candado = await tomarCandado(deps.dir, { modo, inicio: segundos(inicio), pid: process.pid }, { ahoraMs: Date.now(), viejoMs: CANDADO_VIEJO_MS });
  if (!candado) {
    deps.registrar(`otra corrida en curso (${ARCHIVO_CANDADO}): esta no se hace (sin reintento)`);
    return null;
  }
  const cancelarRefresco = deps.programar(() => {
    candado.refrescar().catch((error: unknown) => deps.registrar(`no se pudo refrescar el candado: ${codigoDeError(error)}`));
  }, TIC_MS);
  try {
    deps.registrar(`corrida (${modo}) empieza${desde === null ? "" : ` desde ${desde}`}`);
    const r = await hacerCorrida(deps.corredor, desde, deps.plazoMs);
    const fin = deps.ahora();
    const codigos = r.tareas.map((t) => `${t.tarea} → ${t.codigo}`).join(" · ");
    deps.registrar(`corrida (${modo}) terminó: ${codigos} · ${r.resultado} · ${segundos(fin - inicio)} s`);
    const porTarea = Object.fromEntries(r.tareas.map((t) => [t.tarea, t.codigo]));
    await escribirHuella(deps, ARCHIVO_ULTIMA, { modo, desde: desde ?? "", resultado: r.resultado, inicio: segundos(inicio), fin: segundos(fin), ...porTarea });
    return r;
  } finally {
    cancelarRefresco();
    await candado.soltar().catch((error: unknown) => deps.registrar(`no se pudo soltar el candado: ${codigoDeError(error)}`));
  }
}

export interface Bucle {
  /** Una vuelta: si llegó la hora, lanza la corrida (sin esperarla); siempre escribe el latido. */
  tic(): Promise<void>;
  /** Detiene al hijo en curso, espera la corrida y deja DETENIDO en el latido. Los tics siguientes no hacen nada. */
  detener(): Promise<void>;
  /** Espera la corrida en curso, si hay (con su huella y el candado ya suelto). */
  esperar(): Promise<void>;
  /** Un ciclo de precios intradía, si toca (ventana, interruptor, espera ante un 429); espera a que termine. Nunca lanza. */
  cicloIntradia(): Promise<void>;
}

export function crearBucle(deps: Dependencias): Bucle {
  const arranque = deps.ahora();
  let proxima = proximaCorrida(new Date(arranque)).getTime();
  let enCurso: Promise<void> | null = null;
  let detenido = false;
  const intradia = deps.intradia
    ? crearIntradia({
        config: deps.intradia,
        credencialOk: deps.credencial.ok,
        ahora: deps.ahora,
        registrar: deps.registrar,
        corredor: deps.corredor,
        escribirHuella: (nombre, campos) => escribirHuella(deps, nombre, campos),
        corridaDiariaPendiente: () => enCurso !== null,
      })
    : null;

  const estado = (): string => {
    if (detenido) return "DETENIDO";
    if (!deps.credencial.ok) return deps.credencial.estado;
    return enCurso ? "CORRIENDO" : "ESPERANDO";
  };
  const latir = (): Promise<void> =>
    escribirHuella(deps, ARCHIVO_BUCLE, { estado: estado(), arranque: segundos(arranque), proxima: segundos(proxima), latido: segundos(deps.ahora()) });
  const lanzarCorrida = (): void => {
    // Si un ciclo intradía sigue en curso, la corrida de las 18:00 espera a que termine (el corredor corre una tarea a la vez).
    enCurso = (intradia ? intradia.esperar() : Promise.resolve())
      .then(() => corridaRegistrada(deps, "bucle", null))
      .then(
        () => undefined,
        (error: unknown) => deps.registrar(`la corrida no se pudo hacer: ${codigoDeError(error)}`),
      )
      .finally(() => {
        enCurso = null;
      });
  };

  deps.registrar(`arranca: una corrida de lunes a viernes a las 18:00 COT (precios y luego fondo, sin reintentos); la próxima: ${textoCot(new Date(proxima))}`);
  if (!deps.credencial.ok) deps.registrar(deps.credencial.motivo);

  return {
    async tic() {
      if (detenido) return;
      const t = deps.ahora();
      if (t >= proxima) {
        const hora = textoCot(new Date(proxima));
        proxima = proximaCorrida(new Date(t)).getTime();
        if (!deps.credencial.ok) deps.registrar(`corrida de las ${hora} omitida: ${deps.credencial.estado}`);
        else if (enCurso) deps.registrar(`corrida de las ${hora} omitida: la anterior sigue en curso`);
        else lanzarCorrida();
      }
      await latir();
    },
    async detener() {
      detenido = true;
      intradia?.detener();
      deps.corredor.detener();
      await enCurso;
      await intradia?.esperar();
      await latir();
    },
    async esperar() {
      await enCurso;
    },
    async cicloIntradia() {
      await intradia?.ciclo();
    },
  };
}

/** Señales del proceso (process, o uno falso en las pruebas). */
export interface Senales {
  once(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
  removeListener(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
}

/** El bucle permanente: un tic ya y luego cada TIC_MS, hasta SIGTERM o SIGINT. Devuelve 0 al quedar detenido. */
export function iniciarBucle(deps: Dependencias, senales: Senales): Promise<number> {
  const bucle = crearBucle(deps);
  const cancelarTic = deps.programar(() => void bucle.tic(), TIC_MS);
  const cancelarIntradia = deps.intradia?.encendido ? deps.programar(() => void bucle.cicloIntradia(), deps.intradia.cicloMs) : null;
  const cancelar = (): void => {
    cancelarTic();
    cancelarIntradia?.();
  };
  void bucle.tic();
  return new Promise((resolver) => {
    const parar = (senal: NodeJS.Signals): void => {
      senales.removeListener("SIGTERM", parar);
      senales.removeListener("SIGINT", parar);
      cancelar();
      deps.registrar(`detenido por ${senal}`);
      void bucle.detener().then(() => resolver(SALIDA.BIEN));
    };
    senales.once("SIGTERM", parar);
    senales.once("SIGINT", parar);
  });
}

/**
 * --ahora [--desde AAAA-MM-DD]: una corrida ya, con el candado y la huella. Salida: 0 bien · 3 aviso · 1 fallo ·
 * 2 uso · 64 sin secreto o credencial ajena · 75 otra corrida en curso. Con SIGTERM o SIGINT detiene al hijo.
 */
export async function correrAhora(deps: Dependencias, args: readonly string[], senales?: Senales): Promise<number> {
  const argumentos = leerArgumentosAhora(args, new Date(deps.ahora()));
  if (!argumentos.ok) {
    deps.registrar(argumentos.mensaje);
    return SALIDA.USO;
  }
  if (!deps.credencial.ok) {
    deps.registrar(deps.credencial.motivo);
    return SALIDA.CONFIGURACION;
  }
  const parar = (): void => deps.corredor.detener();
  senales?.once("SIGTERM", parar);
  senales?.once("SIGINT", parar);
  try {
    const r = await corridaRegistrada(deps, "ahora", argumentos.desde);
    return r === null ? SALIDA.OCUPADO : r.codigoSalida;
  } finally {
    senales?.removeListener("SIGTERM", parar);
    senales?.removeListener("SIGINT", parar);
  }
}
