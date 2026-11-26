/**
 * La segunda ranura del bucle del servicio inv-008-precios: durante la rueda de la BVC (lunes a viernes, en la ventana de la
 * configuración), un ciclo de precios intradía cada `cicloMs`. La corrida de las 18:00 no cambia.
 * - Cada ciclo es la tarea `intradia`, un proceso hijo del mismo bundle (scripts/actualizar-intradia.ts), con su plazo (menor que
 *   el ciclo: nunca se encima con el siguiente). La primera vez de cada día corre antes la depuración (`--depurar`), el job de la
 *   retención.
 * - Un solo ciclo a la vez: si el anterior sigue, el nuevo se omite y se dice. Tampoco corre mientras hay una corrida de las
 *   18:00 en curso o esperando (el corredor corre una tarea a la vez); a su vez la corrida de las 18:00 espera a que termine un
 *   ciclo en curso.
 * - Códigos del hijo: 0 bien · 3 alguna especie falló (aviso) · 4 día no hábil (no se vuelve a intentar ese día) · 5 tope diario
 *   de peticiones (tampoco ese día) · 6 sin barras de hoy en un año sin calendario (con DOS seguidos queda «posible día no hábil»
 *   y reintenta cada 30 min, sin congelar el día) · 7 bloqueo de Yahoo (429, 403, red: espera exponencial con tope,
 *   `esperaTrasFallos`) y también TIEMPO (el plazo del hijo venció): ambos cuentan para la racha, y con MAX_LIMITADOS_SEGUIDOS
 *   seguidos el ciclo se detiene hasta el día siguiente · 8 fallo de datos (todas por 404, sin datos o formato raro): espera
 *   exponencial, pero NO cuenta para la racha ni deja la huella en LIMITADO (el vigía no avisa «bloqueo») · cualquier otro (1,
 *   NO_ARRANCO…) queda en el log y espera igual (exponencial con tope); solo un 0 o un 3 reinicia la espera.
 * - Con el interruptor apagado no se piden precios, pero la depuración (que no usa la red) corre una vez al día igual.
 * - Si el servicio se detiene con un ciclo en vuelo (el hijo muere por SIGTERM), eso no es un fallo: se mira antes de interpretar.
 * - Cada ciclo lleva su número (`--rotacion`) para rotar la especie con que empieza.
 * - El log trae solo códigos y estados del servicio: nunca precios, nemotécnicos ni cantidades. El detalle de cada ciclo lo
 *   imprime el hijo (conteos, códigos y el id interno de la especie fallida).
 * - La huella `intradia` (estado, último ciclo en segundos Unix, código, ciclos, fallos seguidos, bloqueos seguidos y hasta cuándo espera) para el
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
/** Tantos códigos 7 seguidos y el ciclo se detiene hasta el día siguiente (el vigía avisa por la huella). */
export const MAX_LIMITADOS_SEGUIDOS = 4;
/** Ciclos seguidos sin barras de hoy (año sin calendario) para marcar «posible día no hábil», y cada cuánto se reintenta entonces. */
const SIN_BARRAS_SEGUIDOS = 2;
const REINTENTO_SIN_BARRAS_MS = 30 * 60_000;

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
  /** El día en que el ciclo ya no se intenta más: día no hábil, tope diario o bloqueos seguidos. */
  let diaQuieto = "";
  let diaVisto = "";
  let fallos = 0;
  let limitados = 0;
  let sinBarras = 0;
  let esperaHasta = 0;
  let ciclos = 0;

  if (!config.encendido) deps.registrar("intradía APAGADO: no se piden precios cada minuto (se enciende con INV_INTRADIA_ENCENDIDO=1)");
  else {
    deps.registrar(`intradía encendido: un ciclo cada ${segundos(config.cicloMs)} s, de lunes a viernes de ${hhmm(config.desdeMin)} a ${hhmm(config.hastaMin)} COT`);
  }
  for (const aviso of config.avisos) deps.registrar(`intradía: ${aviso}`);

  const huella = (estado: string, codigo: string, t: number): Promise<void> =>
    deps.escribirHuella(ARCHIVO_INTRADIA, { estado, ultimo: segundos(t), codigo, ciclos, fallos, limitados, espera: segundos(esperaHasta) });

  /** Aplica el código del ciclo y devuelve el estado de la huella. */
  function interpretar(codigo: string, t: number, dia: string): string {
    if (codigo !== "6") sinBarras = 0; // solo cuentan los seguidos
    if (codigo === "7" || codigo === "TIEMPO") {
      fallos += 1;
      limitados += 1;
      if (limitados >= MAX_LIMITADOS_SEGUIDOS) {
        diaQuieto = dia;
        esperaHasta = 0;
        deps.registrar(`ciclo intradía con bloqueo (429/403/red): ${limitados} veces seguidas (código ${codigo}), se detiene hasta mañana`);
        return "LIMITADO";
      }
      esperaHasta = t + esperaTrasFallos(fallos, config.cicloMs);
      deps.registrar(`ciclo intradía con bloqueo (429/403/red): código ${codigo}, espera hasta las ${textoCot(new Date(esperaHasta))}, máximo ${segundos(MAXIMA_ESPERA_MS)} s`);
      return "LIMITADO";
    }
    if (codigo === "8") {
      // Fallo de datos: espera como un fallo, pero ni suma ni corta la racha de bloqueos.
      fallos += 1;
      esperaHasta = t + esperaTrasFallos(fallos, config.cicloMs);
      deps.registrar(`ciclo intradía con fallo de datos (código 8, no es un bloqueo): espera hasta las ${textoCot(new Date(esperaHasta))}`);
      return "FALLO_DATOS";
    }
    limitados = 0; // cualquier otro código corta la racha de bloqueos
    if (codigo === "6") {
      sinBarras += 1;
      fallos = 0;
      esperaHasta = 0;
      if (sinBarras < SIN_BARRAS_SEGUIDOS) return "ESPERANDO";
      esperaHasta = t + REINTENTO_SIN_BARRAS_MS; // no congela el día: reintenta
      deps.registrar("ciclo intradía: sin barras de hoy y sin calendario del año: posible día no hábil; reintenta en 30 min");
      return "SIN_BARRAS";
    }
    if (codigo === "0") {
      fallos = 0;
      esperaHasta = 0;
      return "ESPERANDO";
    }
    if (codigo === "5") {
      fallos = 0;
      esperaHasta = 0;
      diaQuieto = dia;
      deps.registrar("ciclo intradía: tope diario de peticiones alcanzado (código 5): no se vuelve a intentar hasta mañana");
      return "TOPE_DIA";
    }
    if (codigo === "4") {
      fallos = 0;
      esperaHasta = 0;
      diaQuieto = dia;
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

  /** La depuración de la retención: una sola vez por día, salga como salga. */
  async function depurar(dia: string): Promise<void> {
    if (depuradoEl === dia) return;
    depuradoEl = dia;
    const d = await deps.corredor.correr("intradia", ["--depurar"], PLAZO_DEPURAR_MS);
    if (d.codigo !== "0" && !detenido) deps.registrar(`depuración intradía falló (código ${d.codigo})`);
  }

  async function ejecutar(t: number, dia: string): Promise<void> {
    await depurar(dia);
    const r = await deps.corredor.correr("intradia", ["--rotacion", String(ciclos)], plazoDelCiclo(config.cicloMs));
    // El servicio se apaga: no es un fallo (el hijo puede salir con DETENIDO o muerto por la SIGTERM, SENAL_SIGTERM).
    if (detenido || r.codigo === "DETENIDO") return;
    ciclos += 1;
    await huella(interpretar(r.codigo, deps.ahora(), dia), r.codigo, t);
  }

  return {
    async ciclo() {
      if (detenido || !deps.credencialOk) return;
      const t = deps.ahora();
      const dia = diaCot(t);
      if (dia !== diaVisto) {
        diaVisto = dia;
        limitados = 0; // un día nuevo: se empieza de cero
      }
      // Apagado: no se piden precios, pero la depuración (sin red) corre igual, una vez al día y a cualquier hora.
      const trae = config.encendido;
      if (trae && !enVentanaIntradia(t, config.desdeMin, config.hastaMin)) return;
      if (trae && (dia === diaQuieto || t < esperaHasta)) return;
      if (!trae && depuradoEl === dia) return;
      if (enCurso) {
        if (trae) deps.registrar("ciclo intradía omitido: el anterior sigue en curso");
        return;
      }
      if (deps.corridaDiariaPendiente()) return;
      enCurso = (trae ? ejecutar(t, dia) : depurar(dia))
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
