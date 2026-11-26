/**
 * El bucle del servicio inv-008-alertas.
 * - Latido cada TIC_MS en /estado/bucle (el healthcheck y la huella para el vigía), también durante la evaluación; al terminar cada
 *   una deja /estado/ultima-corrida (resultado OK, AVISO o FALLO, y solo conteos).
 * - En cada ranura (programa.ts: las 18:15 COT y, con el intradía encendido, cada 5 min en la rueda) mira el calendario de la BVC y,
 *   si es día hábil, corre UNA evaluación (`correr`: la lógica de src/alertas/correr.ts, la misma del script a mano). Una a la vez.
 * - Si la evaluación falla (la base, una alerta que no se guardó), espera PAUSA_RANURA_MS y reintenta hasta INTENTOS_RANURA veces; si
 *   no se logra, lo deja en la huella y sigue vivo para la próxima ranura: nunca tumba el servicio.
 * - Sin la credencial (o con una ajena, o si current_user no es inv_alertas) NO se cae: lo dice al arrancar, sigue con latido y no
 *   evalúa. Si saliera, `restart: always` lo volvería a levantar y rompería el `up --wait` y la pausa de PI.
 * - Arrancó después de las 18:15 de un día hábil (un despliegue, un reinicio): evalúa la de hoy, pero SOLO si hoy no hubo ya un intento
 *   de cierre: antes de cada evaluación del cierre (la de las 18:15, la recuperada o el reintento tardío) escribe la marca
 *   «intento-cierre» (el día) en /estado, un volumen que sobrevive a los reinicios. Si una evaluación mata el proceso (OOM), con
 *   `restart: always` el siguiente arranque ve la marca y NO la repite: nunca hay un bucle de muertes. Si la marca no se puede escribir,
 *   no se recupera nada. Lo ya guardado queda como «ya guardado» en la base.
 * - Cada evaluación tiene un plazo (PLAZO_EVALUACION_MS): si lo vence cuenta como fallo (PlazoVencido) y se reintenta.
 * - Si la del cierre queda en FALLO, o se omitió porque había otra en curso, se reintenta cada REINTENTO_TARDIO_MS hasta las 23:59 COT
 *   mientras no haya un OK.
 * - Ninguna línea del log trae la URL, ids, nemotécnicos ni precios: solo conteos, estados y códigos.
 */
import { readFile } from "node:fs/promises";
import { codigoDeError } from "../alertas/guardar";
import { fechaEnBogota } from "../precios/horario";
import { ARCHIVO_BUCLE, ARCHIVO_ULTIMA, escribirAtomico } from "../servicio-precios/estado";
import { diaCot, textoCot } from "../servicio-precios/programa";
import type { Credencial } from "./configuracion";
import { cierreDeHoy, esRanuraDeCierre, proximaRanura } from "./programa";

export const TIC_MS = 60_000;
export const SALIDA = { BIEN: 0, FALLO: 1, USO: 2 } as const;
/** Intentos de una ranura si algo pasajero falla (la base parpadea), con pausa entre ellos. */
export const INTENTOS_RANURA = 3;
export const PAUSA_RANURA_MS = 60_000;
/** Lo más que espera el cierre (la base) antes de salir: Docker da 15 s. */
export const TOPE_CIERRE_MS = 10_000;
/** Lo más que dura una evaluación (la base tiene statement_timeout de 60 s por consulta). */
export const PLAZO_EVALUACION_MS = 120_000;
/** Cada cuánto se reintenta el cierre que quedó en FALLO u omitido, hasta las 23:59 COT. */
export const REINTENTO_TARDIO_MS = 10 * 60_000;
const LIMITE_TARDIO_MIN = 23 * 60 + 59;
/** La marca de «hubo un intento del cierre hoy» (clave dia=AAAA-MM-DD), en el volumen de /estado. */
export const ARCHIVO_MARCA = "intento-cierre";

export type Programar = (accion: () => void, cadaMs: number) => () => void;

/** Lo que el bucle necesita saber de una evaluación (lo que devuelve correrAlertas, sin lo demás). */
export interface ResumenEvaluacion {
  readonly codigoSalida: 0 | 3;
  readonly resultado: { readonly evaluadas: number; readonly insertadas: number; readonly duplicadas: number; readonly fallidas: number };
}

export interface DependenciasBucle {
  readonly dir: string;
  readonly ahora: () => number;
  readonly registrar: (mensaje: string) => void;
  readonly credencial: Credencial;
  readonly programar: Programar;
  /** El interruptor del intradía (INV_INTRADIA_ENCENDIDO, el mismo de precios): encendido, también se evalúa en la rueda. */
  readonly intradia: boolean;
  /** El plazo de una evaluación (por omisión PLAZO_EVALUACION_MS). */
  readonly plazoMs?: number;
  /** ¿La conexión es la del rol inv_alertas (current_user)? */
  revisarRol(): Promise<boolean>;
  /** ¿Hay rueda en la BVC ese día (la fecha de Colombia, a medianoche UTC)? */
  esHabil(hoy: Date): Promise<boolean>;
  correr(ahora: Date): Promise<ResumenEvaluacion>;
  esperar(ms: number): Promise<void>;
}

export interface Bucle {
  tic(): Promise<void>;
  detener(): Promise<void>;
  esperar(): Promise<void>;
}

type Rol = "PENDIENTE" | "OK" | "AJENO";
interface OpcionesAtencion {
  readonly cierre: boolean;
  /** Sin poder escribir la marca, no se evalúa (la recuperación al arrancar). */
  readonly exigirMarca: boolean;
}
type Resultado = "OK" | "AVISO" | "FALLO";

const segundos = (ms: number): number => Math.floor(ms / 1000);

/** El nombre del error y su código (Prisma o SQLSTATE): nunca el mensaje, que puede traer la URL o un dato. */
export function causa(error: unknown): string {
  const codigo = codigoDeError(error) ?? (typeof (error as { code?: unknown } | null)?.code === "string" && /^[A-Z0-9_]{3,16}$/.test((error as { code: string }).code) ? (error as { code: string }).code : null);
  return `${error instanceof Error ? error.name : "error"}${codigo === null ? "" : ` (${codigo})`}`;
}

const minutosCot = (instante: number): number => {
  const l = new Date(instante - 5 * 3_600_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

const conteos = (r: ResumenEvaluacion["resultado"]): string => `evaluadas ${r.evaluadas} · nuevas ${r.insertadas} · ya guardadas ${r.duplicadas} · fallidas ${r.fallidas}`;

export function crearBucle(deps: DependenciasBucle): Bucle {
  const arranque = deps.ahora();
  let proxima = proximaRanura(new Date(arranque), deps.intradia).getTime();
  let enCurso: Promise<void> | null = null;
  let revisando: Promise<void> | null = null;
  let rol: Rol = "PENDIENTE";
  let detenido = false;
  let porRecuperar = deps.credencial.ok;
  let pendiente: { readonly dia: string; ultimo: number } | null = null;
  const plazoMs = deps.plazoMs ?? PLAZO_EVALUACION_MS;

  const estado = (): string => {
    if (detenido) return "DETENIDO";
    if (!deps.credencial.ok) return deps.credencial.estado;
    if (rol === "AJENO") return "SECRETO_INVALIDO";
    if (rol === "PENDIENTE") return "SIN_VERIFICAR";
    return enCurso ? "CORRIENDO" : "ESPERANDO";
  };
  /** Los latidos van en fila (el estado se lee al escribir): el último escrito es siempre el más nuevo. */
  let fila: Promise<void> = Promise.resolve();
  const latir = (): Promise<void> => {
    fila = fila
      .then(() => escribirAtomico(deps.dir, ARCHIVO_BUCLE, { estado: estado(), arranque: segundos(arranque), proxima: segundos(proxima), latido: segundos(deps.ahora()) }))
      .catch((error: unknown) => deps.registrar(`no se pudo escribir el latido: ${causa(error)}`));
    return fila;
  };

  const anotar = async (ranura: Date, opciones: OpcionesAtencion, resultado: Resultado, inicio: number, intentos: number, resumen: ResumenEvaluacion | null): Promise<void> => {
    const cuentas: Record<string, number> = resumen === null ? {} : { evaluadas: resumen.resultado.evaluadas, nuevas: resumen.resultado.insertadas, duplicadas: resumen.resultado.duplicadas, fallidas: resumen.resultado.fallidas };
    try {
      await escribirAtomico(deps.dir, ARCHIVO_ULTIMA, { resultado, ranura: opciones.cierre ? "CIERRE" : "RUEDA", inicio: segundos(inicio), fin: segundos(deps.ahora()), intentos, ...cuentas });
    } catch (error) {
      deps.registrar(`no se pudo escribir la huella de la última evaluación: ${causa(error)}`);
    }
  };

  const conPlazo = <T>(trabajo: Promise<T>): Promise<T> =>
    new Promise<T>((ok, mal) => {
      const reloj = setTimeout(() => mal(Object.assign(new Error("plazo de la evaluación vencido"), { name: "PlazoVencido" })), plazoMs);
      trabajo.then(
        (v) => (clearTimeout(reloj), ok(v)),
        (e: unknown) => (clearTimeout(reloj), mal(e)),
      );
    });

  /** Escribe la marca de hoy; false si no se pudo. */
  const marcarIntento = async (): Promise<boolean> => {
    try {
      await escribirAtomico(deps.dir, ARCHIVO_MARCA, { dia: diaCot(deps.ahora()) });
      return true;
    } catch (error) {
      deps.registrar(`no se pudo escribir la marca del intento del cierre: ${causa(error)}`);
      return false;
    }
  };
  const hayMarcaDeHoy = async (): Promise<boolean> => {
    try {
      return (await readFile(`${deps.dir}/${ARCHIVO_MARCA}`, "utf8")).split("\n").includes(`dia=${diaCot(deps.ahora())}`);
    } catch {
      return false;
    }
  };

  /**
   * Lo de una ranura: el día hábil y la evaluación, con reintentos si algo falla. Devuelve el resultado, o null si no evaluó (día no
   * hábil, sin marca o detenido).
   */
  const atender = async (ranura: Date, opciones: OpcionesAtencion): Promise<Resultado | null> => {
    const hora = textoCot(ranura);
    const inicio = deps.ahora();
    for (let intento = 1; ; intento += 1) {
      let resumen: ResumenEvaluacion | null = null;
      try {
        if (!(await deps.esHabil(fechaEnBogota(ranura)))) {
          if (opciones.cierre) deps.registrar(`ranura de las ${hora}: no es día hábil en la BVC; no se evalúa`);
          return null;
        }
        if (intento === 1) {
          if (opciones.cierre && !(await marcarIntento()) && opciones.exigirMarca) return null;
          deps.registrar(`evaluación de las ${hora} empieza${deps.intradia ? " (intradía encendido)" : ""}`);
        }
        resumen = await conPlazo(deps.correr(new Date(deps.ahora())));
        deps.registrar(`evaluación de las ${hora} terminó: ${conteos(resumen.resultado)} · ${segundos(deps.ahora() - inicio)} s`);
        if (resumen.codigoSalida === 0) {
          await anotar(ranura, opciones, "OK", inicio, intento, resumen);
          return "OK";
        }
        deps.registrar(`evaluación de las ${hora}: alguna alerta no se pudo guardar (salida ${resumen.codigoSalida})`);
      } catch (error) {
        if (detenido) return null;
        deps.registrar(`evaluación de las ${hora} falló: ${causa(error)}`);
      }
      if (detenido) return null;
      if (intento >= INTENTOS_RANURA) {
        const resultado: Resultado = resumen === null ? "FALLO" : "AVISO";
        deps.registrar(`la evaluación de las ${hora} no se pudo hacer: ${resultado}`);
        await anotar(ranura, opciones, resultado, inicio, intento, resumen);
        return resultado;
      }
      deps.registrar(`intento ${intento + 1} de ${INTENTOS_RANURA} en ${PAUSA_RANURA_MS / 1000} s`);
      await deps.esperar(PAUSA_RANURA_MS);
    }
  };

  /** Una evaluación del cierre: si queda en FALLO, se reintenta tarde; con un OK, ya no. */
  const atenderCierre = async (ranura: Date, exigirMarca: boolean): Promise<void> => {
    const r = await atender(ranura, { cierre: true, exigirMarca });
    if (r === "OK") pendiente = null;
    else if (r === "FALLO") pendiente = { dia: diaCot(deps.ahora()), ultimo: deps.ahora() };
  };

  /** Una evaluación a la vez: lo que sigue en curso se espera con `esperar()`; un fallo no se propaga. */
  const lanzar = (tarea: () => Promise<void>): void => {
    enCurso = tarea()
      .catch((error: unknown) => deps.registrar(`la evaluación no se pudo hacer: ${causa(error)}`))
      .finally(() => {
        enCurso = null;
      });
  };

  /** Si el servicio arrancó después de las 18:15 de un día hábil: la evaluación de hoy, una vez. */
  const recuperarHoy = async (): Promise<void> => {
    const ahora = deps.ahora();
    const cierre = cierreDeHoy(new Date(ahora));
    if (cierre === null || cierre.getTime() > ahora) return;
    if (await hayMarcaDeHoy()) return deps.registrar("el servicio arrancó después de las 18:15, pero hoy ya hubo un intento del cierre: no se repite");
    deps.registrar(`el servicio arrancó después de las 18:15 (${textoCot(cierre)}): se recupera la evaluación de hoy`);
    await atenderCierre(cierre, true);
  };

  /** current_user = inv_alertas, como el script. Si la base no responde, se reintenta en el siguiente tic. */
  const revisarElRol = (): void => {
    revisando = (async () => {
      try {
        rol = (await deps.revisarRol()) ? "OK" : "AJENO";
      } catch (error) {
        deps.registrar(`no se pudo revisar el rol de la conexión: ${causa(error)}; se reintenta en el siguiente latido`);
        return;
      }
      if (rol === "AJENO") return deps.registrar("la conexión no es la del rol inv_alertas: el servicio queda en espera y no evalúa alertas");
      if (porRecuperar && !enCurso) lanzar(recuperarHoy);
      porRecuperar = false;
    })().finally(() => {
      revisando = null;
    });
  };

  /** Las omisiones por la credencial o el rol se dicen solo en el cierre (las 80 de la rueda llenarían el log). */
  const omitir = (ranura: Date, motivo: string): void => {
    if (esRanuraDeCierre(ranura)) deps.registrar(`ranura de las ${textoCot(ranura)} omitida: ${motivo}`);
  };

  deps.registrar(
    `arranca: evalúa a las 18:15 en días hábiles de la BVC${deps.intradia ? " y cada 5 min en la rueda (9:30 a 16:05)" : " (intradía apagado)"}; la próxima ranura: ${textoCot(new Date(proxima))}`,
  );
  if (!deps.credencial.ok) deps.registrar(deps.credencial.motivo);

  return {
    async tic() {
      if (detenido) return;
      const t = deps.ahora();
      if (deps.credencial.ok && rol === "PENDIENTE" && revisando === null) revisarElRol();
      if (t >= proxima) {
        const ranura = new Date(proxima);
        proxima = proximaRanura(new Date(t), deps.intradia).getTime();
        if (!deps.credencial.ok) omitir(ranura, deps.credencial.estado);
        else if (rol === "AJENO") omitir(ranura, "SECRETO_INVALIDO");
        else if (rol === "PENDIENTE") omitir(ranura, "el rol de la conexión aún no se verificó");
        else if (enCurso) {
          deps.registrar(`ranura de las ${textoCot(ranura)} omitida: la evaluación anterior sigue en curso`);
          if (esRanuraDeCierre(ranura)) pendiente = { dia: diaCot(t), ultimo: t };
        } else if (esRanuraDeCierre(ranura)) lanzar(() => atenderCierre(ranura, false));
        else lanzar(() => atender(ranura, { cierre: false, exigirMarca: false }).then(() => undefined));
      } else if (pendiente !== null && deps.credencial.ok && rol === "OK" && !enCurso) {
        if (diaCot(t) !== pendiente.dia || minutosCot(t) >= LIMITE_TARDIO_MIN) pendiente = null;
        else if (t - pendiente.ultimo >= REINTENTO_TARDIO_MS) {
          pendiente = { dia: pendiente.dia, ultimo: t };
          deps.registrar("reintento tardío de la evaluación del cierre (no hubo un OK hoy)");
          lanzar(() => atenderCierre(new Date(t), false));
        }
      }
      await latir();
    },
    async detener() {
      detenido = true;
      await latir();
    },
    async esperar() {
      await revisando;
      await enCurso;
    },
  };
}

export interface Senales {
  once(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
  removeListener(senal: "SIGTERM" | "SIGINT", alRecibir: (senal: NodeJS.Signals) => void): unknown;
}

/**
 * El bucle permanente: un tic ya y luego cada TIC_MS, hasta SIGTERM o SIGINT. Al detenerse NO espera la evaluación en curso (Docker da
 * 15 s): deja DETENIDO, llama a `alDetener` (cierra la base, con un tope de TOPE_CIERRE_MS por si se cuelga) y devuelve 0. Lo que quedó
 * a medias no se registra; la siguiente evaluación no lo duplica.
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
      let tope: ReturnType<typeof setTimeout> | undefined;
      const vencido = new Promise<void>((r) => {
        tope = setTimeout(r, TOPE_CIERRE_MS);
      });
      void Promise.race([bucle.detener().then(alDetener), vencido])
        .finally(() => clearTimeout(tope))
        .catch((error: unknown) => deps.registrar(`el cierre falló: ${causa(error)}`))
        .then(() => resolver(SALIDA.BIEN));
    };
    senales.once("SIGTERM", parar);
    senales.once("SIGINT", parar);
  });
}
