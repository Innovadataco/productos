/**
 * El análisis a demanda del servicio inv-008-ia («Analizar con IA»): la corrida de UNA tarea cuando el dueño la pide.
 * Las condiciones de PI (26-nov-2026), cada una con su prueba en tests/unit/servicio-ia/analisis.test.ts:
 * - interruptor en config_ia (`analisisDemanda`, apagado por omisión): se lee en CADA pedido, así que apagarlo desde la
 *   pantalla vale sin reiniciar; sin configuración, o con la IA apagada, no corre nada (falla cerrada);
 * - como máximo UNO en curso y UNO en espera: los demás pedidos se descartan (OCUPADO);
 * - un mínimo de 2 minutos entre análisis, en total y no por tarea, contados desde que TERMINÓ el anterior: el que
 *   espera arranca cuando termina el que corre Y se cumplen los 2 minutos; un pedido sin nada en curso antes de ese
 *   plazo se descarta diciendo cuántos segundos faltan (ESPERA_MINIMA);
 * - un pedido a la vez hacia el modelo: solo corre uno, y además el turno (semáforo) del servicio es el mismo de la
 *   corrida diaria y de «Identificar»/«Probar»;
 * - un registro por llamada al terminar (tarea, modelo, inicio, fin y ms), sin cifras del portafolio, y de un error solo
 *   su código, nunca su mensaje.
 * Sin límite de cantidad por día: es decisión de Jelk. El pedido responde enseguida (202) y la app consulta el estado.
 * Puro: el reloj, el temporizador y la corrida se inyectan.
 */
import { corridaDe } from "../ia/config/cableado";
import type { ConfigIaVigente } from "../ia/config/leer";
import type { TareaIa } from "../ia/config/parametros";
import { PATRON_NOMBRE_MODELO_LOCAL } from "../ia/local/modelos";
import { codigoDeError, type EstadoTipo } from "./corrida";

/** El mínimo entre un análisis y el siguiente: 2 minutos, en total. */
export const ESPERA_MINIMA_MS = 120_000;
const MS_POR_S = 1000;

export type MotivoDescarte = "APAGADO" | "TAREA_INACTIVA" | "OCUPADO" | "ESPERA_MINIMA";
export type ResultadoPedido =
  | { readonly ok: true; readonly lugar: "EN_CURSO" | "EN_ESPERA" }
  | { readonly ok: false; readonly motivo: MotivoDescarte; readonly reintentarEnS?: number };

export interface EstadoAnalisis {
  readonly enCurso: TareaIa | null;
  readonly enEspera: TareaIa | null;
  /** Los segundos que faltan para poder pedir otro (0 si ya se puede). */
  readonly reintentarEnS: number;
  readonly ultimo: { readonly tarea: TareaIa; readonly estado: EstadoTipo | "ERROR" | "DESCARTADO" } | null;
}

export interface DependenciasAnalisis {
  leerConfig(): Promise<ConfigIaVigente | null>;
  /** La corrida de una sola tarea (correrUna con las dependencias reales). Puede lanzar. */
  correr(config: ConfigIaVigente, tarea: TareaIa): Promise<EstadoTipo>;
  /** El instante actual (ms Unix). */
  ahora(): number;
  /** Ejecuta `accion` pasados `ms`. */
  programar(accion: () => void, ms: number): void;
  registrar(mensaje: string): void;
}

export interface AnalisisDemanda {
  pedir(tarea: TareaIa): Promise<ResultadoPedido>;
  estado(): EstadoAnalisis;
}

const descarte = (motivo: MotivoDescarte, reintentarEnS?: number): ResultadoPedido =>
  Object.freeze(reintentarEnS === undefined ? { ok: false, motivo } : { ok: false, motivo, reintentarEnS });

/** ¿La configuración deja correr esta tarea a demanda? Si no, el motivo. */
function motivoDeNo(config: ConfigIaVigente | null, tarea: TareaIa): MotivoDescarte | null {
  if (config === null || !config.analisisDemanda || config.modo === "apagado") return "APAGADO";
  return corridaDe(config, tarea).estado === "APAGADO" ? "TAREA_INACTIVA" : null;
}

export function crearAnalisisDemanda(deps: DependenciasAnalisis): AnalisisDemanda {
  let enCurso: TareaIa | null = null;
  let enEspera: TareaIa | null = null;
  let ultimoFinMs: number | null = null;
  let ultimo: EstadoAnalisis["ultimo"] = null;

  const faltanMs = (): number => (ultimoFinMs === null ? 0 : Math.max(0, ultimoFinMs + ESPERA_MINIMA_MS - deps.ahora()));

  /** El nombre del modelo para el registro: solo con la forma de siempre (el de config_ia podría traer saltos de línea). */
  const modeloParaLog = (config: ConfigIaVigente, tarea: TareaIa): string => {
    const m = config.tareas[tarea].modeloLocal;
    return m === null ? "sin modelo" : PATRON_NOMBRE_MODELO_LOCAL.test(m) ? m : "MODELO_INVALIDO";
  };

  /** Un registro que falla no puede romper el estado ni dejar la espera sin programar. */
  const anotar = (mensaje: string): void => {
    try {
      deps.registrar(mensaje);
    } catch {
      // sin registro no hay nada más que hacer: el servicio sigue.
    }
  };

  const linea = (tarea: TareaIa, config: ConfigIaVigente, inicio: number, fin: number, estado: string, codigo: string | null): string =>
    `análisis a demanda · tarea=${tarea} · modelo=${modeloParaLog(config, tarea)} · inicio=${new Date(inicio).toISOString()} · fin=${new Date(fin).toISOString()} · ms=${fin - inicio} · estado=${estado}${codigo === null ? "" : ` · código=${codigo}`}`;

  /** Corre la tarea (el lugar ya está reservado); al terminar deja el registro y, si hay una en espera, la programa. */
  async function correr(tarea: TareaIa, config: ConfigIaVigente): Promise<void> {
    const inicio = deps.ahora();
    let estado: EstadoTipo | "ERROR" = "ERROR";
    let codigo: string | null = null;
    try {
      estado = await deps.correr(config, tarea);
    } catch (error) {
      codigo = codigoDeError(error);
    }
    const fin = deps.ahora();
    ultimoFinMs = fin;
    ultimo = Object.freeze({ tarea, estado });
    enCurso = null;
    // Primero la espera, después el registro: si el registro falla, la espera no se pierde.
    if (enEspera !== null) deps.programar(() => void arrancarEnEspera().catch(() => undefined), faltanMs());
    anotar(linea(tarea, config, inicio, fin, estado, codigo));
  }

  async function arrancarEnEspera(): Promise<void> {
    const tarea = enEspera;
    if (tarea === null || enCurso !== null) return;
    // Se reserva el lugar ANTES de leer la configuración: un pedido que llegue en ese hueco ya ve «en curso».
    enEspera = null;
    enCurso = tarea;
    let config: ConfigIaVigente | null = null;
    try {
      config = await deps.leerConfig();
    } catch {
      config = null;
    }
    // Si mientras esperaba se apagó el interruptor (o la tarea), o la base no contesta, no arranca: queda dicho.
    if (config === null || motivoDeNo(config, tarea) !== null) {
      const ahora = deps.ahora();
      enCurso = null;
      ultimo = Object.freeze({ tarea, estado: "DESCARTADO" as const });
      anotar(`análisis a demanda · tarea=${tarea} · modelo=${config === null ? "sin modelo" : modeloParaLog(config, tarea)} · inicio=${new Date(ahora).toISOString()} · fin=${new Date(ahora).toISOString()} · ms=0 · estado=DESCARTADO`);
      return;
    }
    await correr(tarea, config);
  }

  return Object.freeze({
    async pedir(tarea: TareaIa): Promise<ResultadoPedido> {
      const config = await deps.leerConfig();
      const motivo = motivoDeNo(config, tarea);
      if (motivo !== null || config === null) return descarte(motivo ?? "APAGADO");
      // Todo lo que sigue es síncrono: sin un `await` de por medio, dos pedidos a la vez no se cruzan.
      if (enCurso !== null) {
        if (enEspera !== null) return descarte("OCUPADO");
        enEspera = tarea;
        return Object.freeze({ ok: true, lugar: "EN_ESPERA" });
      }
      if (enEspera !== null) return descarte("OCUPADO");
      const faltan = faltanMs();
      if (faltan > 0) return descarte("ESPERA_MINIMA", Math.ceil(faltan / MS_POR_S));
      enCurso = tarea;
      void correr(tarea, config).catch(() => undefined);
      return Object.freeze({ ok: true, lugar: "EN_CURSO" });
    },
    estado(): EstadoAnalisis {
      return Object.freeze({ enCurso, enEspera, reintentarEnS: enEspera === null && enCurso === null ? Math.ceil(faltanMs() / MS_POR_S) : 0, ultimo });
    },
  });
}
