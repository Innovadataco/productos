/**
 * Registro de los resúmenes con IA en `resumen_ia` (fase E, E3), con Prisma. Lo escribe el servicio de los resúmenes
 * como inv_ia (INSERT por columna, sin la hora: la pone la base) y lo lee la pantalla como inv_app (SELECT). Nada se edita
 * ni se borra (disparador de solo inserción).
 * - `registrarResumen`: una fila por intento de puerta, armada y revisada por `filaDeResumen`. Un PUBLICADO que llega
 *   cuando ya hay otro con la misma clave (dos corridas a la vez) no falla: queda RECHAZADO con YA_PUBLICADO y sus tokens
 *   (el gasto de la nube no se pierde), sin abortar la transacción del llamador (INSERT … ON CONFLICT DO NOTHING).
 * - `yaPublicado`: si ya hay un PUBLICADO con esa clave (para no volver a llamar al modelo). Lo usa el servicio.
 * - `ultimoPublicado`: el PUBLICADO más reciente de un tipo y un día exacto, de cualquier prompt o modelo, con su paquete
 *   reconstruido por `leerPaquete` (si no cuadra, GUARDADO_INVALIDO) y la salida del modelo, para que quien lo muestre
 *   pueda volver a validarla y renderizarla. Lo usa la pantalla (inv_app): inv_ia no lee el texto ni los hechos.
 * - `gastoDelMes`: la suma de los tokens de una puerta en [desde, hasta), por la hora que puso la base (el mes de
 *   Colombia lo da `rangoDelMes`); los tokens nulos cuentan 0.
 * Si la base o el cliente rechazan una escritura, ErrorRegistro BASE_RECHAZADA, sin el mensaje original: el de PostgreSQL
 * trae la fila entera (el texto y los hechos).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { TIPOS_RESUMEN, type DiaIso, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esDe, esDiaIso } from "../formas";
import { PUERTAS, type Puerta } from "../generador";
import { ErrorPaquete, leerPaquete } from "../paquete";
import {
  diaDeFecha, ErrorRegistro, fechaDeDia, filaDeResumen, leerClave, MOTIVO_YA_PUBLICADO,
  type ClaveResumen, type EntradaResumen, type EstadoResumen, type FilaResumen,
} from "./fila";

/** El cliente de la app, una transacción o un cliente con otro rol: solo se usa `resumenIa`. */
export type BaseRegistro = Pick<PrismaClient, "resumenIa"> | Prisma.TransactionClient;

export interface ResumenRegistrado {
  readonly id: string;
  /** La hora que puso la base (clock_timestamp()). */
  readonly generadoEn: Date;
  /** El estado con el que quedó: un PUBLICADO repetido queda RECHAZADO. */
  readonly estado: EstadoResumen;
  /** Si era un PUBLICADO y ya había otro con la misma clave. */
  readonly yaPublicado: boolean;
}

export interface ResumenPublicado {
  readonly id: string;
  readonly tipo: TipoResumen;
  readonly fechaNegocio: DiaIso;
  readonly puerta: Puerta;
  readonly texto: string;
  /** La salida del modelo de la que salió el texto (saneada si traía un NUL o un sustituto suelto). */
  readonly salidaModelo: string;
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
  /** Filas de esa puerta en el rango, de cualquier estado (también los FALLIDO, que no traen tokens). */
  readonly corridas: number;
}

const SELECCION_REGISTRO = Object.freeze({ id: true, generadoEn: true } as const);

const esErrorDeEscritura = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientValidationError;

/** Escribe; si la base o el cliente la rechazan, BASE_RECHAZADA sin el mensaje (traería la fila). */
async function escribir<T>(escritura: () => Promise<T>): Promise<T> {
  try {
    return await escritura();
  } catch (error) {
    if (esErrorDeEscritura(error)) throw new ErrorRegistro("BASE_RECHAZADA");
    throw error;
  }
}

/** Un PUBLICADO: ON CONFLICT DO NOTHING (el índice único parcial); si ya había uno, RECHAZADO con YA_PUBLICADO. */
async function registrarPublicado(db: BaseRegistro, fila: FilaResumen): Promise<ResumenRegistrado> {
  const [creada] = await escribir(() => db.resumenIa.createManyAndReturn({ data: [fila], skipDuplicates: true, select: SELECCION_REGISTRO }));
  if (creada !== undefined) return Object.freeze({ ...creada, estado: "PUBLICADO", yaPublicado: false });
  const repetida = { ...fila, estado: "RECHAZADO" as const, texto: null, motivos: [MOTIVO_YA_PUBLICADO] };
  const r = await escribir(() => db.resumenIa.create({ data: repetida, select: SELECCION_REGISTRO }));
  return Object.freeze({ ...r, estado: "RECHAZADO", yaPublicado: true });
}

/** Registra una corrida. Revisa la entrada antes de escribir (ErrorRegistro con su código). */
export async function registrarResumen(db: BaseRegistro, entrada: EntradaResumen): Promise<ResumenRegistrado> {
  const fila = filaDeResumen(entrada);
  if (fila.estado === "PUBLICADO") return registrarPublicado(db, fila);
  const r = await escribir(() => db.resumenIa.create({ data: fila, select: SELECCION_REGISTRO }));
  return Object.freeze({ ...r, estado: fila.estado, yaPublicado: false });
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

const SELECCION_PUBLICADO = Object.freeze({
  id: true, tipo: true, fechaNegocio: true, puerta: true, texto: true, salidaModelo: true, hechos: true, hechosHash: true, promptVersion: true,
  promptHash: true, modelo: true, modeloDigest: true, validadorVersion: true, generadoEn: true,
} as const);
type FilaPublicada = Prisma.ResumenIaGetPayload<{ select: typeof SELECCION_PUBLICADO }>;

/** El paquete guardado, reconstruido; si no cuadra con lo guardado o con su fila, GUARDADO_INVALIDO. */
function paqueteGuardado(fila: FilaPublicada): PaqueteHechos {
  let paquete: PaqueteHechos;
  try {
    paquete = leerPaquete(fila.hechos);
  } catch (error) {
    if (error instanceof ErrorPaquete) throw new ErrorRegistro("GUARDADO_INVALIDO");
    throw error;
  }
  if (paquete.hash !== fila.hechosHash || paquete.tipo !== fila.tipo || paquete.hoy !== diaDeFecha(fila.fechaNegocio)) throw new ErrorRegistro("GUARDADO_INVALIDO");
  return paquete;
}

/** El PUBLICADO más reciente (por la hora de la base) de ese tipo y ese día, de cualquier prompt o modelo; null si no hay. */
export async function ultimoPublicado(db: BaseRegistro, tipo: TipoResumen, fechaNegocio: DiaIso): Promise<ResumenPublicado | null> {
  if (!esDe(TIPOS_RESUMEN, tipo) || typeof fechaNegocio !== "string" || !esDiaIso(fechaNegocio)) throw new ErrorRegistro("CLAVE_INVALIDA");
  const fila = await db.resumenIa.findFirst({
    where: { estado: "PUBLICADO", tipo, fechaNegocio: fechaDeDia(fechaNegocio) },
    orderBy: [{ generadoEn: "desc" }, { id: "desc" }],
    select: SELECCION_PUBLICADO,
  });
  if (fila === null) return null;
  const { puerta, texto, salidaModelo, modelo, modeloDigest } = fila;
  if (puerta === null || texto === null || salidaModelo === null || modelo === null || modeloDigest === null) throw new ErrorRegistro("GUARDADO_INVALIDO");
  return Object.freeze({
    id: fila.id, tipo, fechaNegocio: diaDeFecha(fila.fechaNegocio), puerta, texto, salidaModelo, paquete: paqueteGuardado(fila),
    hechosHash: fila.hechosHash, promptVersion: fila.promptVersion, promptHash: fila.promptHash, modelo, modeloDigest,
    validadorVersion: fila.validadorVersion, generadoEn: fila.generadoEn,
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
