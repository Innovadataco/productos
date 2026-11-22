/**
 * Registro de los resúmenes con IA en `resumen_ia` (fase E, E3), con Prisma. Lo escribe el servicio de los resúmenes
 * como inv_ia (INSERT por columna, sin la hora: la pone la base) y lo lee la pantalla como inv_app (SELECT). Nada se edita
 * ni se borra (disparador de solo inserción).
 * - `registrarResumen`: una fila por intento de puerta, armada y revisada por `filaDeResumen`; un PUBLICADO repetido
 *   (misma clave) da ErrorRegistro YA_PUBLICADO sin escribir.
 * - `yaPublicado`: si ya hay un PUBLICADO con esa clave (para no volver a llamar al modelo).
 * - `ultimoPublicado`: el PUBLICADO más reciente de un tipo y un día exacto, con su paquete reconstruido por
 *   `leerPaquete` (si no cuadra, GUARDADO_INVALIDO: no se muestra un texto con cifras que no se pueden reconstruir).
 * - `gastoDelMes`: la suma de los tokens de una puerta en [desde, hasta), por la hora que puso la base, para el tope
 *   mensual de la nube; los tokens nulos cuentan 0.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { TIPOS_RESUMEN, type DiaIso, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esDe, esDiaIso } from "../formas";
import { PUERTAS, type Puerta } from "../generador";
import { ErrorPaquete, leerPaquete } from "../paquete";
import { diaDeFecha, ErrorRegistro, fechaDeDia, filaDeResumen, leerClave, type ClaveResumen, type EntradaResumen } from "./fila";

/** El cliente de la app, una transacción o un cliente con otro rol: solo se usa `resumenIa`. */
export type BaseRegistro = Pick<PrismaClient, "resumenIa"> | Prisma.TransactionClient;

export interface ResumenRegistrado {
  readonly id: string;
  /** La hora que puso la base (clock_timestamp()). */
  readonly generadoEn: Date;
}

export interface ResumenPublicado {
  readonly id: string;
  readonly tipo: TipoResumen;
  readonly fechaNegocio: DiaIso;
  readonly puerta: Puerta;
  readonly texto: string;
  /** El paquete guardado, reconstruido y validado (`esPaqueteConstruido` lo reconoce). */
  readonly paquete: PaqueteHechos;
  readonly hechosHash: string;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly modelo: string;
  readonly modeloDigest: string;
  readonly validadorVersion: string;
  readonly generadoEn: Date;
}

export interface GastoTokens {
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
  /** Filas de esa puerta en el rango (cualquier estado). */
  readonly corridas: number;
}

/** Registra una corrida. Revisa la entrada antes de escribir; un PUBLICADO repetido da YA_PUBLICADO. */
export async function registrarResumen(db: BaseRegistro, entrada: EntradaResumen): Promise<ResumenRegistrado> {
  const fila = filaDeResumen(entrada);
  try {
    return await db.resumenIa.create({ data: fila, select: { id: true, generadoEn: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ErrorRegistro("YA_PUBLICADO");
    throw error;
  }
}

/** ¿Hay ya un PUBLICADO con esa clave? */
export async function yaPublicado(db: BaseRegistro, clave: ClaveResumen): Promise<boolean> {
  const c = leerClave(clave);
  const fila = await db.resumenIa.findFirst({
    where: { estado: "PUBLICADO", tipo: c.tipo, fechaNegocio: c.fecha, hechosHash: c.hechosHash, promptHash: c.promptHash, modeloDigest: c.modeloDigest },
    select: { id: true },
  });
  return fila !== null;
}

/** El PUBLICADO más reciente (por la hora de la base) de ese tipo y ese día; null si no hay. */
export async function ultimoPublicado(db: BaseRegistro, tipo: TipoResumen, fechaNegocio: DiaIso): Promise<ResumenPublicado | null> {
  if (!esDe(TIPOS_RESUMEN, tipo) || typeof fechaNegocio !== "string" || !esDiaIso(fechaNegocio)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "PUBLICADO", tipo, fechaNegocio: fechaDeDia(fechaNegocio) },
    orderBy: [{ generadoEn: "desc" }, { id: "desc" }],
    select: {
      id: true, tipo: true, fechaNegocio: true, puerta: true, texto: true, hechos: true, hechosHash: true, promptVersion: true, promptHash: true,
      modelo: true, modeloDigest: true, validadorVersion: true, generadoEn: true,
    },
  });
  if (fila === null) return null;
  const { puerta, texto, modelo, modeloDigest } = fila;
  if (puerta === null || texto === null || modelo === null || modeloDigest === null) throw new ErrorRegistro("GUARDADO_INVALIDO");
  let paquete: PaqueteHechos;
  try {
    paquete = leerPaquete(fila.hechos);
  } catch (error) {
    if (error instanceof ErrorPaquete) throw new ErrorRegistro("GUARDADO_INVALIDO");
    throw error;
  }
  if (paquete.hash !== fila.hechosHash || paquete.tipo !== fila.tipo || paquete.hoy !== diaDeFecha(fila.fechaNegocio)) throw new ErrorRegistro("GUARDADO_INVALIDO");
  return Object.freeze({
    id: fila.id, tipo: fila.tipo, fechaNegocio: diaDeFecha(fila.fechaNegocio), puerta, texto, paquete, hechosHash: fila.hechosHash,
    promptVersion: fila.promptVersion, promptHash: fila.promptHash, modelo, modeloDigest, validadorVersion: fila.validadorVersion, generadoEn: fila.generadoEn,
  });
}

const esFecha = (valor: unknown): valor is Date => valor instanceof Date && Number.isFinite(valor.getTime());

/** La suma de los tokens de una puerta en [desde, hasta), por la hora del registro. */
export async function gastoDelMes(db: BaseRegistro, puerta: Puerta, desde: Date, hasta: Date): Promise<GastoTokens> {
  if (!esDe(PUERTAS, puerta)) throw new ErrorRegistro("PUERTA_INVALIDA");
  if (!esFecha(desde) || !esFecha(hasta) || desde.getTime() >= hasta.getTime()) throw new ErrorRegistro("RANGO_INVALIDO");
  const suma = await db.resumenIa.aggregate({
    where: { puerta, generadoEn: { gte: desde, lt: hasta } },
    _sum: { tokensEntrada: true, tokensSalida: true },
    _count: { _all: true },
  });
  return Object.freeze({ tokensEntrada: suma._sum.tokensEntrada ?? 0, tokensSalida: suma._sum.tokensSalida ?? 0, corridas: suma._count._all });
}
