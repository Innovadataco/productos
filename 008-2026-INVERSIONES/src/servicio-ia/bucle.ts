/**
 * El bucle del servicio inv-008-ia (E6).
 * - Latido cada TIC_MS en /estado/bucle (el healthcheck), también durante la corrida.
 * - En cada ranura (programa.ts) lee la configuración vigente: sin ella o en «apagado», nada; si la ranura no es su
 *   hora, nada; si el día no es hábil en la BVC, nada; si no, la corrida diaria (corrida.ts). Una a la vez.
 * - Sin la credencial (o con una ajena) NO se cae: lo dice al arrancar, sigue con latido y no toca la base. Si saliera,
 *   `restart: always` lo volvería a levantar y rompería el `up --wait`, la reanudación y la pausa de PI.
 * - Ninguna línea del log trae la URL, el token, el destino ni cifras: solo tipos, estados y códigos.
 */
import type { ConfigIaVigente } from "../ia/config/leer";
import { fechaEnBogota } from "../precios/horario";
import { ARCHIVO_BUCLE, escribirAtomico } from "../servicio-precios/estado";
import { textoCot } from "../servicio-precios/programa";
import type { Credencial } from "./configuracion";
import { codigoDeError, type ResumenCorrida } from "./corrida";
import { horaDeRanura, proximaRanura } from "./programa";

export const TIC_MS = 60_000;
export const SALIDA = { BIEN: 0, FALLO: 1, USO: 2 } as const;

export type Programar = (accion: () => void, cadaMs: number) => () => void;

export interface DependenciasBucle {
  readonly dir: string;
  readonly ahora: () => number;
  readonly registrar: (mensaje: string) => void;
  readonly credencial: Credencial;
  readonly programar: Programar;
  leerConfig(): Promise<ConfigIaVigente | null>;
  /** ¿Hay rueda en la BVC ese día (la fecha de Colombia, a medianoche UTC)? */
  esHabil(hoy: Date): Promise<boolean>;
  correr(config: ConfigIaVigente, hoy: Date): Promise<ResumenCorrida>;
}

export interface Bucle {
  tic(): Promise<void>;
  detener(): Promise<void>;
  esperar(): Promise<void>;
}

const segundos = (ms: number): number => Math.floor(ms / 1000);

export function crearBucle(deps: DependenciasBucle): Bucle {
  const arranque = deps.ahora();
  let proxima = proximaRanura(new Date(arranque)).getTime();
  let enCurso: Promise<void> | null = null;
  let detenido = false;

  const estado = (): string => {
    if (detenido) return "DETENIDO";
    if (!deps.credencial.ok) return deps.credencial.estado;
    return enCurso ? "CORRIENDO" : "ESPERANDO";
  };
  /** Los latidos van en fila (el estado se lee al escribir): el último escrito es siempre el más nuevo. */
  let fila: Promise<void> = Promise.resolve();
  const latir = (): Promise<void> => {
    fila = fila
      .then(() => escribirAtomico(deps.dir, ARCHIVO_BUCLE, { estado: estado(), arranque: segundos(arranque), proxima: segundos(proxima), latido: segundos(deps.ahora()) }))
      .catch((error: unknown) => deps.registrar(`no se pudo escribir el latido: ${codigoDeError(error)}`));
    return fila;
  };

  /** Lo de una ranura: la configuración, su hora, el día hábil y la corrida. */
  const atenderRanura = async (ranura: Date): Promise<void> => {
    const hora = textoCot(ranura);
    const config = await deps.leerConfig();
    if (config === null || config.modo === "apagado") return deps.registrar(`ranura de las ${hora}: la IA está apagada (sin configuración o en modo apagado); no se hace nada`);
    if (config.horaResumen !== horaDeRanura(ranura)) return;
    const hoy = fechaEnBogota(ranura);
    if (!(await deps.esHabil(hoy))) return deps.registrar(`ranura de las ${hora}: no es día hábil en la BVC; no hay resumen`);
    deps.registrar(`corrida de las ${hora} empieza (configuración v${config.version}, modo ${config.modo})`);
    const inicio = deps.ahora();
    const r = await deps.correr(config, hoy);
    const tipos = Object.entries(r.porTipo).map(([tipo, e]) => `${tipo} → ${e}`).join(" · ");
    deps.registrar(`corrida de las ${hora} terminó: ${tipos === "" ? r.estado : tipos} · ${segundos(deps.ahora() - inicio)} s`);
  };
  const lanzar = (ranura: Date): void => {
    enCurso = atenderRanura(ranura)
      .catch((error: unknown) => deps.registrar(`la corrida no se pudo hacer: ${codigoDeError(error)}`))
      .finally(() => {
        enCurso = null;
      });
  };

  deps.registrar(`arranca: el resumen a la hora de config_ia, en días hábiles de la BVC; la próxima ranura: ${textoCot(new Date(proxima))}`);
  if (!deps.credencial.ok) deps.registrar(deps.credencial.motivo);

  return {
    async tic() {
      if (detenido) return;
      const t = deps.ahora();
      if (t >= proxima) {
        const ranura = new Date(proxima);
        proxima = proximaRanura(new Date(t)).getTime();
        if (!deps.credencial.ok) deps.registrar(`ranura de las ${textoCot(ranura)} omitida: ${deps.credencial.estado}`);
        else if (enCurso) deps.registrar(`ranura de las ${textoCot(ranura)} omitida: la corrida anterior sigue en curso`);
        else lanzar(ranura);
      }
      await latir();
    },
    async detener() {
      detenido = true;
      await latir();
    },
    async esperar() {
      await enCurso;
    },
  };
}

export interface Senales {
  once(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
  removeListener(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
}

/**
 * El bucle permanente: un tic ya y luego cada TIC_MS, hasta SIGTERM o SIGINT. Al detenerse NO espera la corrida en
 * curso (un pedido al modelo puede tardar minutos y Docker da 15 s): deja DETENIDO, llama a `alDetener` (cierra el
 * servidor y la base) y devuelve 0. Lo que quedó a medias no se registra; la siguiente corrida no lo duplica.
 */
export function iniciarBucle(deps: DependenciasBucle, senales: Senales, alDetener: () => Promise<void> = () => Promise.resolve()): Promise<number> {
  const bucle = crearBucle(deps);
  const cancelar = deps.programar(() => void bucle.tic(), TIC_MS);
  void bucle.tic();
  return new Promise((resolver) => {
    const parar = (senal: NodeJS.Signals): void => {
      senales.removeListener("SIGTERM", parar);
      senales.removeListener("SIGINT", parar);
      cancelar();
      deps.registrar(`detenido por ${senal}`);
      void bucle
        .detener()
        .then(alDetener)
        .catch((error: unknown) => deps.registrar(`el cierre falló: ${codigoDeError(error)}`))
        .then(() => resolver(SALIDA.BIEN));
    };
    senales.once("SIGTERM", parar);
    senales.once("SIGINT", parar);
  });
}
