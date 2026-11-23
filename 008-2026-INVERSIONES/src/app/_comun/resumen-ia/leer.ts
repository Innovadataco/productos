import "server-only";
/**
 * La lectura de la tarjeta de resumen (E5) para una pantalla. Solo lectura (inv_app hace SELECT de resumen_ia).
 * - El día es el de Colombia (`fechaEnBogota`); se muestra solo un PUBLICADO de ese día exacto (publicado.ts, la lectura
 *   de `ultimoPublicado` de E3 sin el módulo que escribe).
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
import { ErrorRegistro } from "@/ia/registro/fila";
import type { ResumenPublicado } from "@/ia/registro/registro";
import { diaIso, fechaEnBogota } from "@/precios/horario";
import { conTurno } from "../../proyecciones/turno";
import { esErrorDeBase } from "../sin-base";
import { elegirResumen, type PaqueteDeHoy } from "./elegir";
import { publicadoDelDia } from "./publicado";
import type { VistaResumenIa } from "./tipos";

/** Cuánto vale lo armado: corto, para que DESACTUALIZADO no tarde en verse. */
export const TTL_MEMO_MS = 60_000;

export type LeerPaquetes = (db: PrismaClient, hoy: Date) => Promise<ResultadoExportacion>;

export interface OpcionesResumen {
  readonly ahora?: Date;
  /** El export; por omisión, `exportarHechos`. */
  readonly paquetes?: LeerPaquetes;
}

interface Guardado {
  readonly dia: string;
  readonly hastaMs: number;
  readonly resultado: ResultadoExportacion;
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

async function leerPublicado(db: PrismaClient, tipo: TipoResumen, dia: string): Promise<ResumenPublicado | null> {
  try {
    return await publicadoDelDia(db, tipo, dia);
  } catch (error) {
    if (!(error instanceof ErrorRegistro)) throw error;
    console.error(`[resumen-ia] ${tipo}: el publicado no se puede leer (${error.codigo})`);
    return null;
  }
}

/** El export de hoy: el guardado si sigue vigente; si no, bajo el turno. null con el motivo si no hubo turno. */
async function exportDeHoy(db: PrismaClient, usuarioId: string, hoy: Date, ahora: Date, paquetes: LeerPaquetes): Promise<ResultadoExportacion | string> {
  const dia = diaIso(hoy);
  const g = memo().actual;
  if (g !== null && g.dia === dia && ahora.getTime() < g.hastaMs) return g.resultado;
  const turno = await conTurno(usuarioId, ahora.getTime(), () => paquetes(db, hoy));
  if (!turno.ok) return turno.motivo;
  memo().actual = { dia, hastaMs: ahora.getTime() + TTL_MEMO_MS, resultado: turno.valor };
  return turno.valor;
}

async function paqueteDeHoy(db: PrismaClient, tipo: TipoResumen, usuarioId: string, hoy: Date, ahora: Date, paquetes: LeerPaquetes): Promise<PaqueteDeHoy> {
  try {
    const r = await exportDeHoy(db, usuarioId, hoy, ahora, paquetes);
    if (typeof r === "string") return { paquete: null, motivo: r };
    const paquete = r.paquetes.find((p) => p.tipo === tipo) ?? null;
    return paquete === null ? { paquete: null, motivo: r.omitidos.find((o) => o.tipo === tipo)?.codigo ?? "SIN_PAQUETE" } : { paquete, motivo: null };
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[resumen-ia] ${tipo}: no se pudo armar el paquete de hoy (${nombreDe(error)})`);
    return { paquete: null, motivo: "FALLO" };
  }
}

/** La tarjeta de ese tipo para hoy. `usuarioId` es el de la sesión ya exigida (el turno va por usuario). */
export async function resumenDelDia(db: PrismaClient, tipo: TipoResumen, usuarioId: string, opciones: OpcionesResumen = {}): Promise<VistaResumenIa> {
  const ahora = opciones.ahora ?? new Date();
  const hoy = fechaEnBogota(ahora);
  const publicado = await leerPublicado(db, tipo, diaIso(hoy));
  const deHoy = await paqueteDeHoy(db, tipo, usuarioId, hoy, ahora, opciones.paquetes ?? exportarHechos);
  const { vista, descarte } = elegirResumen({ tipo, publicado, hoy: deHoy });
  if (descarte !== null) console.error(`[resumen-ia] ${tipo}: el publicado no pasó el validador y no se muestra (${descarte.join(",")})`);
  return vista;
}
