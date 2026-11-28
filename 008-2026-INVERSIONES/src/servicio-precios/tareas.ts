/**
 * Corredor de tareas del servicio inv-008-precios. Cada tarea (precios, fondo e intradia) corre como un proceso hijo del MISMO
 * bundle (`node <banderas> servicio-precios.mjs <tarea> [--desde …]`): es el mismo CLI de scripts/, con sus mensajes,
 * sus topes de red y sus códigos de salida, y el plazo mata de verdad (los CLI corren al cargarse y salen con
 * process.exit: no se pueden repetir ni cortar dentro del proceso del bucle).
 * - Plazo (timeout) por tarea: al vencer, SIGTERM; si no sale en la gracia, SIGKILL. Sin reintentos.
 * - stdout y stderr heredados (al log del contenedor): los CLI imprimen solo conteos, códigos e ids internos.
 * - Sin shell y sin stdin. Las tareas van de a una (precios y luego fondo; el ciclo intradía solo corre en la rueda, nunca junto a la
 *   corrida de las 18:00): un solo hijo a la vez, por la memoria.
 * Códigos: el de salida del CLI («0», «3»…), TIEMPO (venció el plazo), SENAL_<señal> (lo mató otra señal),
 * NO_ARRANCO (no se pudo lanzar) o DETENIDO (el servicio se está deteniendo: no se lanza).
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

export const PLAZO_TAREA_MS = 15 * 60_000;
export const GRACIA_MS = 5_000;

export type Tarea = "precios" | "fondo" | "intradia";

export interface ResultadoTarea {
  readonly tarea: Tarea;
  readonly codigo: string;
  readonly duracionMs: number;
}

export interface Corredor {
  correr(tarea: Tarea, args: readonly string[], plazoMs: number): Promise<ResultadoTarea>;
  /** Detiene al hijo en curso (SIGTERM y, pasada la gracia, SIGKILL) y no deja lanzar otro. */
  detener(): void;
}

export type Lanzar = (ejecutable: string, args: readonly string[], opciones: SpawnOptions) => ChildProcess;

export interface OpcionesCorredor {
  /** process.execPath */
  readonly ejecutable: string;
  /** process.execArgv: las mismas banderas de node (p. ej. --max-old-space-size=64). */
  readonly argumentosNode: readonly string[];
  /** La ruta del bundle (process.argv[1]). */
  readonly script: string;
  readonly env: NodeJS.ProcessEnv;
  readonly graciaMs?: number;
  readonly lanzar?: Lanzar;
  readonly ahora?: () => number;
}

const lanzarSinShell: Lanzar = (ejecutable, args, opciones) => spawn(ejecutable, [...args], opciones);

const yaSalio = (hijo: ChildProcess): boolean => hijo.exitCode !== null || hijo.signalCode !== null;

const terminados = new WeakSet<ChildProcess>();

/**
 * Manda SIGTERM y, si el hijo no sale en la gracia, SIGKILL. Una sola vez por hijo (vencer el plazo y detener pueden
 * coincidir) y nunca a uno que ya salió.
 */
function terminar(hijo: ChildProcess, graciaMs: number): void {
  if (terminados.has(hijo) || yaSalio(hijo)) return;
  terminados.add(hijo);
  hijo.kill("SIGTERM");
  const golpe = setTimeout(() => {
    if (!yaSalio(hijo)) hijo.kill("SIGKILL");
  }, graciaMs);
  hijo.once("close", () => clearTimeout(golpe));
}

export function crearCorredor(o: OpcionesCorredor): Corredor {
  const graciaMs = o.graciaMs ?? GRACIA_MS;
  const lanzar = o.lanzar ?? lanzarSinShell;
  const ahora = o.ahora ?? Date.now;
  let enCurso: ChildProcess | null = null;
  let detenido = false;

  const correr = (tarea: Tarea, args: readonly string[], plazoMs: number): Promise<ResultadoTarea> => {
    if (detenido) return Promise.resolve({ tarea, codigo: "DETENIDO", duracionMs: 0 });
    const inicio = ahora();
    return new Promise((resolver) => {
      let vencido = false;
      let listo = false;
      const terminarCon = (codigo: string) => {
        if (listo) return;
        listo = true;
        clearTimeout(plazo);
        enCurso = null;
        resolver({ tarea, codigo, duracionMs: ahora() - inicio });
      };
      const hijo = lanzar(o.ejecutable, [...o.argumentosNode, o.script, tarea, ...args], { stdio: ["ignore", "inherit", "inherit"], env: o.env });
      enCurso = hijo;
      const plazo = setTimeout(() => {
        vencido = true;
        terminar(hijo, graciaMs);
      }, plazoMs);
      hijo.once("error", () => terminarCon("NO_ARRANCO"));
      hijo.once("close", (codigo: number | null, senal: NodeJS.Signals | null) => {
        if (vencido) terminarCon("TIEMPO");
        else if (codigo !== null) terminarCon(String(codigo));
        else terminarCon(`SENAL_${String(senal)}`);
      });
    });
  };

  return {
    correr,
    detener() {
      detenido = true;
      if (enCurso) terminar(enCurso, graciaMs);
    },
  };
}
