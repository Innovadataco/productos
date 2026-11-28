/**
 * Cableado real del servicio inv-008-precios (lo usa scripts/servicio-precios.ts, el bundle de la imagen de la app):
 * la carpeta de la huella (/estado, o PRECIOS_ESTADO_DIR en las pruebas), el reloj, el log con la hora de Colombia,
 * el corredor que relanza el MISMO bundle para cada tarea, la credencial revisada (nunca la URL) y la configuración del ciclo
 * intradía (variables INV_INTRADIA_*, con sus valores por omisión).
 */
import { iniciarBucle, correrAhora, type Dependencias, type Programar, type Senales } from "./bucle";
import { revisarCredencial } from "./configuracion";
import { ESTADO_DIR_POR_DEFECTO } from "./estado";
import { leerConfigIntradia } from "./intradia-configuracion";
import { textoCot } from "./programa";
import { crearCorredor } from "./tareas";

/** Lo que el servicio usa del proceso de node (process, o uno falso en las pruebas). */
export interface Proceso extends Senales {
  readonly env: NodeJS.ProcessEnv;
  readonly execPath: string;
  readonly execArgv: readonly string[];
  readonly stdout: { write(texto: string): unknown };
}

const programarConIntervalo: Programar = (accion, cadaMs) => {
  const intervalo = setInterval(accion, cadaMs);
  return () => clearInterval(intervalo);
};

/** Las dependencias reales. `script` es la ruta del bundle (process.argv[1]): cada tarea lo relanza. */
export function dependenciasReales(proceso: Proceso, script: string): Dependencias {
  return {
    dir: proceso.env.PRECIOS_ESTADO_DIR || ESTADO_DIR_POR_DEFECTO,
    ahora: Date.now,
    registrar: (mensaje) => void proceso.stdout.write(`${textoCot(new Date())} [precios] ${mensaje}\n`),
    corredor: crearCorredor({ ejecutable: proceso.execPath, argumentosNode: proceso.execArgv, script, env: proceso.env }),
    credencial: revisarCredencial(proceso.env.DATABASE_URL),
    programar: programarConIntervalo,
    intradia: leerConfigIntradia(proceso.env),
  };
}

/** `servicio-precios.mjs bucle`: el servicio permanente. Sale con 0 al recibir SIGTERM o SIGINT. */
export function servirBucle(proceso: Proceso, script: string): Promise<number> {
  return iniciarBucle(dependenciasReales(proceso, script), proceso);
}

/** `servicio-precios.mjs --ahora [--desde AAAA-MM-DD]`: una corrida ya (carga histórica). */
export function servirAhora(proceso: Proceso, script: string, args: readonly string[]): Promise<number> {
  return correrAhora(dependenciasReales(proceso, script), args, proceso);
}
