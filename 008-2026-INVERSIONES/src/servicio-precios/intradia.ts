/**
 * La segunda ranura del bucle del servicio inv-008-precios: durante la rueda de la BVC (lunes a viernes, en la ventana de la
 * configuración), un ciclo de precios intradía cada `cicloMs`. La corrida de las 18:00 no cambia.
 * - Cada ciclo es la tarea `intradia`, un proceso hijo del mismo bundle (scripts/actualizar-intradia.ts), con su plazo (menor que
 *   el ciclo: nunca se encima con el siguiente). La primera vez de cada día corre antes la depuración (`--depurar`), el job de la
 *   retención.
 * - Un solo ciclo a la vez: si el anterior sigue, el nuevo se omite y se dice. Tampoco corre mientras hay una corrida de las
 *   18:00 en curso o esperando (el corredor corre una tarea a la vez); a su vez la corrida de las 18:00 espera a que termine un
 *   ciclo en curso.
 * - Códigos del hijo: 0 bien · 3 alguna especie falló (aviso) · 4 día no hábil (no se vuelve a intentar ese día) · 7 Yahoo
 *   limitó con 429 o bloqueó (espera exponencial con tope, `esperaTrasFallos`) · cualquier otro (1, TIEMPO,
 *   NO_ARRANCO…) queda en el log y espera igual (exponencial con tope); solo un 0 o un 3 reinicia la espera.
 * - El log trae solo códigos y estados del servicio: nunca precios, nemotécnicos ni cantidades. El detalle de cada ciclo lo
 *   imprime el hijo (conteos, códigos y el id interno de la especie fallida).
 * - La huella `intradia` (estado, último ciclo en segundos Unix, código, ciclos, fallos seguidos y hasta cuándo espera) para el
 *   vigía; clave=valor, como las demás (estado.ts).
 */
import type { Campos } from "./estado";
import type { ConfigIntradia } from "./intradia-configuracion";
import { MAXIMA_ESPERA_MS, diaCot, enVentanaIntradia, esperaTrasFallos, textoCot } from "./programa";
import type { Corredor } from "./tareas";

export const ARCHIVO_INTRADIA = "intradia";
const PLAZO_DEPURAR_MS = 30_000;
const PLAZO_MAXIMO_CICLO_MS = 50_000;
const PLAZO_MINIMO_CICLO_MS = 10_000;
const HOLGURA_CICLO_MS = 5_000;

/** El plazo del ciclo: 50 s, y siempre menos que el ciclo (con una holgura). */
export const plazoDelCiclo = (cicloMs: number): number => Math.max(PLAZO_MINIMO_CICLO_MS, Math.min(PLAZO_MAXIMO_CICLO_MS, cicloMs - HOLGURA_CICLO_MS));

export interface DependenciasIntradia {
  readonly config: ConfigIntradia;
  readonly credencialOk: boolean;
  readonly ahora: () => number;
  readonly registrar: (mensaje: string) => void;
  readonly corredor: Corredor;
  readonly escribirHuella: (nombre: string, campos: Campos) => Promise<void>;
  /** ¿Hay una corrida de las 18:00 en curso o esperando su turno? */
  readonly corridaDiariaPendiente: () => boolean;
}

export interface Intradia {
  /** Un ciclo, si toca; espera a que termine. Nunca lanza. */
  ciclo(): Promise<void>;
  /** Espera el ciclo en curso, si hay. */
  esperar(): Promise<void>;
  /** Ya no lanza más ciclos (el corredor se detiene aparte). */
  detener(): void;
}

const hhmm = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function crearIntradia(deps: DependenciasIntradia): Intradia {
  const { config } = deps;
  const segundos = (ms: number): number => Math.floor(ms / 1000);
  let enCurso: Promise<void> | null = null;
  let detenido = false;
  let depuradoEl = "";
  let diaNoHabil = "";
  let fallos = 0;
  let esperaHasta = 0;
  let ciclos = 0;

  if (!config.encendido) deps.registrar("intradía apagado: no se piden precios cada minuto");
  else {
    deps.registrar(`intradía encendido: un ciclo cada ${segundos(config.cicloMs)} s, de lunes a viernes de ${hhmm(config.desdeMin)} a ${hhmm(config.hastaMin)} COT`);
  }
  for (const aviso of config.avisos) deps.registrar(`intradía: ${aviso}`);

  const huella = (estado: string, codigo: string, t: number): Promise<void> =>
    deps.escribirHuella(ARCHIVO_INTRADIA, { estado, ultimo: segundos(t), codigo, ciclos, fallos, espera: segundos(esperaHasta) });

  /** Aplica el código del ciclo y devuelve el estado de la huella. */
  function interpretar(codigo: string, t: number, dia: string): string {
    if (codigo === "0") {
      fallos = 0;
      esperaHasta = 0;
      return "ESPERANDO";
    }
    if (codigo === "7") {
      fallos += 1;
      esperaHasta = t + esperaTrasFallos(fallos, config.cicloMs);
      deps.registrar(`ciclo intradía limitado por Yahoo (429, código 7): espera hasta las ${textoCot(new Date(esperaHasta))}, máximo ${segundos(MAXIMA_ESPERA_MS)} s`);
      return "LIMITADO";
    }
    if (codigo === "4") {
      fallos = 0;
      esperaHasta = 0;
      diaNoHabil = dia;
      deps.registrar("ciclo intradía: hoy no hay rueda en la BVC (código 4): no se vuelve a intentar hasta mañana");
      return "NO_HABIL";
    }
    if (codigo === "3") {
      fallos = 0;
      esperaHasta = 0;
      deps.registrar("ciclo intradía con aviso (código 3): alguna especie no se trajo");
      return "AVISO";
    }
    // Cualquier otro fallo (1, TIEMPO, NO_ARRANCO…) también espera, exponencialmente: no se insiste cada minuto.
    fallos += 1;
    esperaHasta = t + esperaTrasFallos(fallos, config.cicloMs);
    deps.registrar(`ciclo intradía falló (código ${codigo}): espera hasta las ${textoCot(new Date(esperaHasta))}`);
    return "FALLO";
  }

  async function ejecutar(t: number, dia: string): Promise<void> {
    if (depuradoEl !== dia) {
      depuradoEl = dia; // una sola vez por día, salga como salga
      const d = await deps.corredor.correr("intradia", ["--depurar"], PLAZO_DEPURAR_MS);
      if (d.codigo !== "0") deps.registrar(`depuración intradía falló (código ${d.codigo})`);
    }
    const r = await deps.corredor.correr("intradia", [], plazoDelCiclo(config.cicloMs));
    if (r.codigo === "DETENIDO") return; // el servicio se apaga: no es un fallo
    ciclos += 1;
    await huella(interpretar(r.codigo, deps.ahora(), dia), r.codigo, t);
  }

  return {
    async ciclo() {
      if (detenido || !config.encendido || !deps.credencialOk) return;
      const t = deps.ahora();
      if (!enVentanaIntradia(t, config.desdeMin, config.hastaMin)) return;
      const dia = diaCot(t);
      if (dia === diaNoHabil || t < esperaHasta) return;
      if (enCurso) {
        deps.registrar("ciclo intradía omitido: el anterior sigue en curso");
        return;
      }
      if (deps.corridaDiariaPendiente()) return;
      enCurso = ejecutar(t, dia)
        .catch((error: unknown) => deps.registrar(`el ciclo intradía no se pudo hacer: ${error instanceof Error ? error.name : "ERROR"}`))
        .finally(() => {
          enCurso = null;
        });
      await enCurso;
    },
    async esperar() {
      await enCurso;
    },
    detener() {
      detenido = true;
    },
  };
}
