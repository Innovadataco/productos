import "server-only";
/**
 * La lectura de la tarjeta de resumen (E5) para una pantalla. Solo lectura (inv_app hace SELECT de resumen_ia).
 * - Se muestra el ÚLTIMO PUBLICADO del tipo, de cualquier día, con su fecha y hora (publicado.ts, la lectura de
 *   `ultimoPublicado` de E3 sin el módulo que escribe); si ya no corresponde a los hechos de hoy, sale DESACTUALIZADO. El
 *   último RECHAZADO por el validador, si es más nuevo, se informa con su motivo. El día de hoy (Colombia) es para el
 *   paquete de hoy, con el que se compara.
 * - El botón «Analizar con IA» (`puedeAnalizar`): solo si quien mira es el dueño Y el interruptor de config_ia está
 *   encendido (apagado por omisión). Cualquier error al leer la configuración lo deja apagado (falla cerrada).
 * - «IA apagada» (`sinIa`), para todos: sin análisis que mostrar y con la configuración apagada (sin ella, modo apagado,
 *   análisis a demanda apagado o tarea inactiva). Si la configuración no se pudo leer, no se afirma nada.
 * - El paquete de hoy sale del export de E7 (`exportarHechos`): la MISMA función que arma los paquetes del servicio, en
 *   una foto de solo lectura, para que el hash de los hechos sea comparable. Como proyecta (≈ 1 s de cálculo síncrono),
 *   corre bajo el turno de las proyecciones (src/app/proyecciones/turno.ts, por fuera de la foto) y queda en memoria del
 *   proceso TTL_MEMO_MS por día: las tres pantallas usan la misma corrida. Sin turno (EN_VUELO, FRECUENCIA, OCUPADO),
 *   no hay paquete de hoy y la tarjeta no se cae.
 * - Un ErrorRegistro del publicado (lo guardado no cuadra) se trata como «sin publicado»; se registra solo su código.
 * - Un fallo de la base se propaga (la página muestra «No se pudo leer la base»); otro error deja la tarjeta «no
 *   disponible» y se registra solo su nombre (el mensaje podría traer cifras o nombres del portafolio).
 */
import type { PrismaClient } from "@prisma/client";
import type { TipoResumen } from "@/ia/contrato";
import { exportarHechos, type ResultadoExportacion } from "@/ia/evaluacion/exportar/exportar";
import { leerConfigIa, type ConfigIaVigente } from "@/ia/config/leer";
import { ErrorRegistro } from "@/ia/registro/fila";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { diaIso, fechaEnBogota } from "@/precios/horario";
import { conTurno } from "../../proyecciones/turno";
import { esErrorDeBase } from "../sin-base";
import { elegirResumen, noDisponible, type PaqueteDeHoy } from "./elegir";
import { ultimoPublicadoDe, ultimoRechazadoDe, type ResumenRechazado } from "./publicado";
import type { VistaResumenIa } from "./tipos";

/**
 * Cuánto vale lo armado, desde que empezó la corrida: corto, para que DESACTUALIZADO no tarde en verse (una carga nueva
 * puede tardar hasta esto en notarse). Dos visitas a la vez comparten la corrida en vuelo (no proyectan dos veces ni
 * chocan por EN_VUELO). Una corrida sin turno o que falló no queda guardada.
 * /proyecciones proyecta dos veces en la primera visita (su cálculo de 60 meses y este de 12): no se puede reutilizar
 * el suyo, porque el paquete ESCENARIOS es a 12 meses (el del servicio); esto lo acota a una vez por minuto.
 */
export const TTL_MEMO_MS = 60_000;

export type LeerPaquetes = (db: PrismaClient, hoy: Date) => Promise<ResultadoExportacion>;

export interface OpcionesResumen {
  readonly ahora?: Date;
  /** El export; por omisión, `exportarHechos`. */
  readonly paquetes?: LeerPaquetes;
  /** ¿Quien mira es el dueño? Solo él puede tener el botón «Analizar con IA»; sin decirlo, no. */
  readonly dueno?: boolean;
}

type Corrida = { readonly ok: true; readonly resultado: ResultadoExportacion } | { readonly ok: false; readonly motivo: string };

interface Guardado {
  readonly dia: string;
  readonly desdeMs: number;
  readonly hastaMs: number;
  readonly corrida: Promise<Corrida>;
}

const CLAVE = Symbol.for("inv008.resumen-ia.memo");
const memo = (): { actual: Guardado | null } => {
  const g = globalThis as Record<symbol, { actual: Guardado | null } | undefined>;
  g[CLAVE] ??= { actual: null };
  return g[CLAVE];
};

/** Solo para las pruebas: sin nada guardado. */
export function reiniciarMemoParaPruebas(): void {
  memo().actual = null;
}

const nombreDe = (error: unknown): string => (error instanceof Error ? error.name : "desconocido");

async function leerPublicado(db: PrismaClient, tipo: TipoResumen): Promise<ResumenPublicado | null> {
  try {
    return await ultimoPublicadoDe(db, tipo);
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    const detalle = error instanceof ErrorRegistro ? error.codigo : nombreDe(error);
    console.error(`[resumen-ia] ${tipo}: el publicado no se puede leer (${detalle})`);
    return null;
  }
}

/** El último análisis rechazado por el validador; un error que no es de la base lo deja sin él (se registra solo el nombre). */
async function leerRechazado(db: PrismaClient, tipo: TipoResumen): Promise<ResumenRechazado | null> {
  try {
    return await ultimoRechazadoDe(db, tipo);
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[resumen-ia] ${tipo}: el último rechazado no se puede leer (${error instanceof ErrorRegistro ? error.codigo : nombreDe(error)})`);
    return null;
  }
}

/** La configuración vigente; un error que no es de la base (o que la configuración no se lee) da `ok: false`: ni botón ni afirmar que está apagada. */
type LecturaConfig = { readonly ok: true; readonly config: ConfigIaVigente | null } | { readonly ok: false };

async function leerConfig(db: PrismaClient): Promise<LecturaConfig> {
  try {
    return { ok: true, config: await leerConfigIa(db) };
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[resumen-ia] la configuración de la IA no se puede leer (${nombreDe(error)})`);
    return { ok: false };
  }
}

/** ¿La configuración tiene la IA apagada para esta tarjeta? Sin configuración, modo apagado, análisis a demanda apagado o tarea inactiva. */
const iaApagadaPara = (lectura: LecturaConfig, tipo: TipoResumen): boolean =>
  lectura.ok && (lectura.config === null || lectura.config.modo === "apagado" || !lectura.config.analisisDemanda || !lectura.config.tareas[tipo].activo);

/** ¿El dueño tiene el botón? Con el interruptor de config_ia encendido; sin configuración o con un error, no (falla cerrada). */
const botonDisponible = (lectura: LecturaConfig, dueno: boolean): boolean => dueno && lectura.ok && lectura.config?.analisisDemanda === true;

/** Saca la corrida del memo si sigue siendo la guardada (no pisa una más nueva). */
const olvidar = (guardado: Guardado): void => {
  if (memo().actual === guardado) memo().actual = null;
};

/** El export de hoy: el guardado (o en vuelo) si sigue vigente; si no, una corrida nueva bajo el turno. */
async function exportDeHoy(db: PrismaClient, usuarioId: string, hoy: Date, ahora: Date, paquetes: LeerPaquetes): Promise<Corrida> {
  const dia = diaIso(hoy);
  const ahoraMs = ahora.getTime();
  const g = memo().actual;
  if (g !== null && g.dia === dia && ahoraMs >= g.desdeMs && ahoraMs < g.hastaMs) return g.corrida;
  const corrida: Promise<Corrida> = conTurno(usuarioId, ahoraMs, () => paquetes(db, hoy))
    .then((t): Corrida => (t.ok ? { ok: true, resultado: t.valor } : { ok: false, motivo: t.motivo }));
  const guardado: Guardado = { dia, desdeMs: ahoraMs, hastaMs: ahoraMs + TTL_MEMO_MS, corrida };
  memo().actual = guardado;
  try {
    const r = await corrida;
    if (!r.ok) olvidar(guardado);
    return r;
  } catch (error) {
    olvidar(guardado);
    throw error;
  }
}

async function paqueteDeHoy(db: PrismaClient, tipo: TipoResumen, usuarioId: string, hoy: Date, ahora: Date, paquetes: LeerPaquetes): Promise<PaqueteDeHoy> {
  try {
    const r = await exportDeHoy(db, usuarioId, hoy, ahora, paquetes);
    if (!r.ok) return { paquete: null, motivo: r.motivo };
    const paquete = r.resultado.paquetes.find((p) => p.tipo === tipo) ?? null;
    return paquete === null ? { paquete: null, motivo: r.resultado.omitidos.find((o) => o.tipo === tipo)?.codigo ?? "SIN_PAQUETE" } : { paquete, motivo: null };
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[resumen-ia] ${tipo}: no se pudo armar el paquete de hoy (${nombreDe(error)})`);
    return { paquete: null, motivo: "FALLO" };
  }
}

/**
 * La tarjeta de ese tipo para hoy. `usuarioId` es el de la sesión ya exigida (el turno va por usuario). La tarjeta no
 * tumba la página: fuera de un fallo de la base, cualquier error la deja «no disponible» (se registra solo el nombre).
 */
export async function resumenDelDia(db: PrismaClient, tipo: TipoResumen, usuarioId: string, opciones: OpcionesResumen = {}): Promise<VistaResumenIa> {
  try {
    const ahora = opciones.ahora ?? new Date();
    const hoy = fechaEnBogota(ahora);
    const publicado = await leerPublicado(db, tipo);
    const rechazado = await leerRechazado(db, tipo);
    const deHoy = await paqueteDeHoy(db, tipo, usuarioId, hoy, ahora, opciones.paquetes ?? exportarHechos);
    const lectura = await leerConfig(db);
    const { vista, descarte } = elegirResumen({ tipo, publicado, rechazado, iaApagada: iaApagadaPara(lectura, tipo), hoy: deHoy });
    if (descarte !== null) console.error(`[resumen-ia] ${tipo}: el publicado no pasó el validador y no se muestra (${descarte.join(",")})`);
    return botonDisponible(lectura, opciones.dueno === true) ? Object.freeze({ ...vista, puedeAnalizar: true }) : vista;
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[resumen-ia] ${tipo}: la tarjeta no se pudo armar (${nombreDe(error)})`);
    return noDisponible(tipo, "FALLO");
  }
}
