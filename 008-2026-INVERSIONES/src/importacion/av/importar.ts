/**
 * Importa la certificación PDF de Acciones & Valores de forma atómica (PR-B del hito 1).
 * - Sin un llavero válido falla cerrado (ErrorCifrado) antes de tocar la base: no queda ni la carga rechazada.
 * - Solo el DUENO activo importa.
 * - Una fila inválida, una fecha de corte inválida, un conflicto o un fallo de la base → la carga queda RECHAZADA
 *   (con códigos y ubicaciones, nunca valores) y no se guarda ningún hecho.
 * - Reimportar el mismo PDF con la misma fecha no duplica: carga CARGADO «repetida», 0 filas nuevas.
 *   La misma fecha con otras filas es CONFLICTO_CERTIFICACION: lo importado no se edita (se revierte la carga).
 * - El mismo archivo (sha256) con otra fecha de corte es ARCHIVO_YA_CARGADO. La fecha de una certificación retirada
 *   (corte equivocado, corregida a su corte real) queda ocupada por su historia: CORTE_RETIRADO.
 * - El archivo original no se guarda: solo su sha256, un nombre fijo y las filas cifradas.
 * - La corrección del corte de una certificación ya cargada (corregir.ts) reutiliza `nueva`, el rechazo y los candados.
 * - Corte real (frente certificacion-corte-real): si la fecha de corte no puede ser la de la certificación (el PDF se
 *   generó antes del cierre definitivo de ese día, o después del corte pedido), el rechazo lleva `pistaCorte` (el día
 *   que el CLI sugiere) y `yaCargadaEn` (el corte con que ya está cargado ese mismo PDF, si lo está): así el CLI manda
 *   a corregir el corte en vez de reimportar. Nada de eso se guarda en la base.
 * - Señal 1 del corte real: una certificación NUEVA cuyos precios de valoración son los cierres ya guardados del día
 *   hábil anterior (`corteReal`, la misma regla de la conciliación) se rechaza con CORTE_NO_COINCIDE y la pista del día.
 *   Si faltan cierres, alguna especie no existe o el año no está sembrado, no se puede saber y no bloquea. La
 *   reimportación idempotente (la misma certificación ya cargada) no se bloquea: la corrige `corregir-corte-certificacion`.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { ErrorCifrado } from "../../cifrado/errores";
import { corteReal } from "../../conciliacion/corte-real";
import { cierresDelDia } from "../../conciliacion/esperado";
import { ConflictoConcurrente } from "../../precios/guardar";
import { corteOcupado } from "../../conciliacion/vigente";
import { CODIGO_UNICIDAD, esErrorPrisma } from "../../lib/choques";
import { obtenerLlavero, type Llavero } from "../../cifrado/llavero";
import { analizarCertificacion, errorDeDocumento as documento, type CertificacionAnalizada } from "./analisis";
import { isoDia, leerCalendarioCorte, ultimoCorteDefinitivo, ultimoHabilAnterior, validarFechaCorte, type CalendarioCorte, type PistaCorte } from "./fecha-corte";
import type { ErrorFilaAv } from "./filas";
import {
  ErrorImportacionAv, TIPO_FUENTE, buscarEspecies, filasSiCoinciden, guardarCertificacion, guardarFilas, registrarVistas, resolverEspecies, resolverFondos,
} from "./guardar";
import { MAX_BYTES } from "./pdf/documento";

export type { PistaCorte };
export const MAX_ERRORES_REGISTRADOS = 100;
const MAX_INTENTOS = 2;
export { MAX_BYTES };

export interface ArchivoCertificacion {
  readonly contenido: Uint8Array;
  readonly usuarioId: string;
  /** La da el dueño: el texto del PDF no la trae. */
  readonly fechaCorte: Date;
  /** codigoFic (SFC) del fondo, para vincular su NIT la primera vez. */
  readonly fondoCodigo?: string | null;
  /** Reloj inyectable (pruebas). */
  readonly hoy?: Date;
}

export interface ResultadoImportacionAv {
  readonly cargaId: string;
  readonly estado: "CARGADO" | "RECHAZADO";
  readonly repetida: boolean;
  readonly certificacionId: string | null;
  readonly filasTotal: number;
  readonly filasNuevas: number;
  readonly filasRepetidas: number;
  readonly instrumentosCreados: number;
  readonly fondoVinculado: boolean;
  readonly errores: readonly ErrorFilaAv[];
  /** Solo en un rechazo porque la fecha de corte no es el corte real: el día que se sugiere y por qué. */
  readonly pistaCorte?: PistaCorte | null;
  /** Solo junto con `pistaCorte`: el corte con que ese mismo PDF ya está cargado (AAAA-MM-DD), o null. */
  readonly yaCargadaEn?: string | null;
}

const sinNada = { repetida: false, certificacionId: null, filasNuevas: 0, filasRepetidas: 0, instrumentosCreados: 0, fondoVinculado: false, pistaCorte: null, yaCargadaEn: null } as const;

type Pista = Pick<ResultadoImportacionAv, "pistaCorte" | "yaCargadaEn">;

/** El candado consultivo de las importaciones de certificaciones (una a la vez); la corrección del corte también lo toma. */
export const CANDADO_IMPORTAR = `inv008-importar-${TIPO_FUENTE}`;

/** Registra la carga RECHAZADO (códigos y ubicaciones, nunca valores). También la usa la corrección del corte. */
export async function registrarRechazo(db: PrismaClient, base: Base, filasTotal: number, errores: readonly ErrorFilaAv[], pista: Pista = {}): Promise<ResultadoImportacionAv> {
  const registrados = errores.slice(0, MAX_ERRORES_REGISTRADOS);
  const carga = await db.cargaArchivo.create({
    data: {
      tipoFuente: TIPO_FUENTE, nombreArchivo: base.nombre, sha256: base.sha256, fechaCorte: base.fecha, estado: "RECHAZADO", filasTotal,
      errores: { total: errores.length, errores: registrados } as unknown as Prisma.InputJsonValue, cargadoPorId: base.usuarioId,
    },
  });
  return { ...sinNada, ...pista, cargaId: carga.id, estado: "RECHAZADO", filasTotal, errores: registrados };
}

/** Lo que lleva la carga: quién, qué archivo (sha256), con qué corte y con qué nombre fijo. */
export interface Base {
  readonly usuarioId: string;
  readonly sha256: string;
  readonly fecha: Date;
  readonly nombre: string;
  readonly fondoCodigo: string | null;
}

const CODIGO_PRISMA: Readonly<Record<string, string>> = { P2028: "TIEMPO_AGOTADO", P2034: "CONFLICTO_CONCURRENTE" };

const POR_EL_PDF = new Set(["FECHA_CORTE_ANTES_DEL_CIERRE", "FECHA_CORTE_POSTERIOR_AL_PDF"]);

/** El corte con que ese mismo archivo ya está cargado (una carga CARGADO de certificación con su sha256), o null. */
async function cargadaEn(db: PrismaClient, sha256: string): Promise<string | null> {
  const carga = await db.cargaArchivo.findFirst({ where: { tipoFuente: TIPO_FUENTE, sha256, estado: "CARGADO" }, orderBy: { cargadoEn: "asc" }, select: { fechaCorte: true } });
  return carga?.fechaCorte ? isoDia(carga.fechaCorte) : null;
}

/** La pista por la CreationDate del PDF (ANTES_DEL_CIERRE o POSTERIOR_AL_PDF): el día con cierre definitivo a esa hora; si no, null. */
export function pistaPorPdf(codigo: string, creadoEn: Date | null, calendario: CalendarioCorte): PistaCorte | null {
  if (!POR_EL_PDF.has(codigo) || creadoEn === null) return null;
  return { tipo: "PDF", generadoEn: creadoEn, sugerido: ultimoCorteDefinitivo(creadoEn, calendario) };
}

/** Si el rechazo fue por la CreationDate del PDF: el día con cierre definitivo a esa hora y si ese PDF ya está cargado. */
async function pistaDeFecha(db: PrismaClient, codigo: string, creadoEn: Date | null, calendario: CalendarioCorte, sha256: string): Promise<Pista> {
  const pista = pistaPorPdf(codigo, creadoEn, calendario);
  return pista === null ? {} : { pistaCorte: pista, yaCargadaEn: await cargadaEn(db, sha256) };
}

/** La misma fecha ya tiene certificación: o es el mismo contenido (repetida) o es un conflicto. */
async function repetida(tx: Prisma.TransactionClient, base: Base, a: CertificacionAnalizada, existente: { id: string; cargaId: string }, llavero: Llavero): Promise<ResultadoImportacionAv> {
  const porLlave = await filasSiCoinciden(tx, existente.cargaId, a.registros, llavero);
  if (!porLlave) throw new ErrorImportacionAv("CONFLICTO_CERTIFICACION");
  const n = a.registros.length;
  const carga = await tx.cargaArchivo.create({
    data: { tipoFuente: TIPO_FUENTE, nombreArchivo: base.nombre, sha256: base.sha256, fechaCorte: base.fecha, estado: "CARGADO", filasTotal: n, filasNuevas: 0, filasRepetidas: n, cargadoPorId: base.usuarioId },
  });
  await registrarVistas(tx, carga.id, a.registros, porLlave);
  return { ...sinNada, cargaId: carga.id, estado: "CARGADO", repetida: true, certificacionId: existente.id, filasTotal: n, filasRepetidas: n, errores: [] };
}

/** El archivo como carga: su sha256 y el nombre fijo con la fecha de corte (el nombre real no se guarda). */
export function baseDe(contenido: Uint8Array, usuarioId: string, fecha: Date, fondoCodigo: string | null): Base {
  return { usuarioId, sha256: createHash("sha256").update(contenido).digest("hex"), fecha, nombre: `certificacion-av-${isoDia(fecha)}.pdf`, fondoCodigo };
}

/** Una certificación nueva por el camino de siempre (carga, especies, fondo, filas cifradas, certificación). También la usa la corrección. */
export async function nueva(tx: Prisma.TransactionClient, base: Base, a: CertificacionAnalizada, llavero: Llavero): Promise<ResultadoImportacionAv> {
  const carga = await tx.cargaArchivo.create({
    data: { tipoFuente: TIPO_FUENTE, nombreArchivo: base.nombre, sha256: base.sha256, fechaCorte: base.fecha, estado: "VALIDANDO", cargadoPorId: base.usuarioId },
  });
  const ubicaciones = new Map([...a.leida.lotes].reverse().map((l) => [l.nemo, { pagina: l.pagina, fila: l.numero, columna: "NEMOTÉCNICO" }] as const));
  const especies = await resolverEspecies(tx, a.posiciones.map((p) => p.nemo), ubicaciones);
  const fondos = await resolverFondos(tx, a.leida.fondos, base.fondoCodigo);
  await guardarFilas(tx, carga.id, a.registros, llavero);
  const certificacionId = await guardarCertificacion(tx, { cargaId: carga.id, fechaCorte: base.fecha, analizada: a, especies: especies.ids, fondos: fondos.ids }, llavero);
  const n = a.registros.length;
  await tx.cargaArchivo.update({ where: { id: carga.id }, data: { estado: "CARGADO", filasTotal: n, filasNuevas: n, filasRepetidas: 0 } });
  return { ...sinNada, cargaId: carga.id, estado: "CARGADO", certificacionId, filasTotal: n, filasNuevas: n, instrumentosCreados: especies.creadas, fondoVinculado: fondos.vinculado, errores: [] };
}

/** Un rechazo porque la fecha de corte no es el corte real, con su pista (el día sugerido y por qué). */
export class ErrorCorte extends ErrorImportacionAv {
  constructor(codigo: string, readonly pista: PistaCorte | null) {
    super(codigo);
    this.name = "ErrorCorte";
  }
}

/**
 * Señal 1: lanza ErrorCorte (CORTE_NO_COINCIDE) si los precios de valoración son los cierres guardados del día hábil
 * anterior al corte y no los del corte (`corteReal`, con las especies comparables). Solo lee: no crea especies.
 */
export async function exigirCorteReal(tx: Prisma.TransactionClient, fecha: Date, a: CertificacionAnalizada, calendario: CalendarioCorte): Promise<void> {
  const anterior = ultimoHabilAnterior(fecha, calendario);
  if (!anterior.ok) return;
  const ids = await buscarEspecies(tx, a.posiciones.map((p) => p.nemo));
  const todos = [...ids.values()];
  const [delCorte, delAnterior] = [await cierresDelDia(tx, fecha, todos), await cierresDelDia(tx, new Date(`${anterior.dia}T00:00:00Z`), todos)];
  const cierre = (m: ReadonlyMap<string, string>, nemo: string) => {
    const id = ids.get(nemo);
    return id === undefined ? null : (m.get(id) ?? null);
  };
  const precios = a.posiciones.map((p) => ({ precioValoracion: p.precioValoracion, cierre: cierre(delCorte, p.nemo), cierreAnterior: cierre(delAnterior, p.nemo) }));
  const r = corteReal(precios);
  if (r !== null) throw new ErrorCorte("CORTE_NO_COINCIDE", { tipo: "PRECIOS", sugerido: anterior.dia, especies: r.especies, distintas: r.distintas });
}

async function enTransaccion(db: PrismaClient, base: Base, a: CertificacionAnalizada, llavero: Llavero, calendario: CalendarioCorte): Promise<ResultadoImportacionAv> {
  return db.$transaction(
    async (tx) => {
      // Una sola importación de certificaciones a la vez: el chequeo de sha256 y de fecha no tiene carreras.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CANDADO_IMPORTAR}))`;
      const mismoArchivo = await tx.cargaArchivo.findFirst({ where: { tipoFuente: TIPO_FUENTE, sha256: base.sha256, estado: "CARGADO", NOT: { fechaCorte: base.fecha } }, select: { id: true } });
      if (mismoArchivo) throw new ErrorImportacionAv("ARCHIVO_YA_CARGADO");
      const existente = await corteOcupado(tx, base.fecha);
      // La fecha de una certificación retirada (corte equivocado) queda ocupada por su historia.
      if (existente?.reemplazo) throw new ErrorImportacionAv("CORTE_RETIRADO");
      if (existente) return repetida(tx, base, a, existente, llavero);
      await exigirCorteReal(tx, base.fecha, a, calendario);
      return nueva(tx, base, a, llavero);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/**
 * Código del fallo, sin el mensaje (el de Prisma puede traer valores). P2028 = transacción vencida. Un choque con otra
 * corrida (la re-verificación de precios o una serialización de la base, P2034) es CONFLICTO_CONCURRENTE: basta repetir.
 */
export function errorDe(e: unknown): ErrorFilaAv {
  if (e instanceof ErrorImportacionAv) return { ...e.ubicacion, codigo: e.codigo };
  if (e instanceof ErrorCifrado) return documento(e.codigo);
  if (e instanceof ConflictoConcurrente) return documento("CONFLICTO_CONCURRENTE");
  if (e instanceof Prisma.PrismaClientKnownRequestError) return documento(CODIGO_PRISMA[e.code] ?? `BASE_${e.code}`);
  return documento("BASE_ERROR");
}

export async function importarCertificacion(db: PrismaClient, archivo: ArchivoCertificacion): Promise<ResultadoImportacionAv> {
  const llavero = obtenerLlavero(); // primero: sin claves no se escribe nada, ni el rechazo
  const usuario = await db.usuario.findUnique({ where: { id: archivo.usuarioId }, select: { activo: true, rol: true } });
  if (!usuario || !usuario.activo || usuario.rol !== "DUENO") throw new ErrorImportacionAv("USUARIO_NO_AUTORIZADO");
  const base = baseDe(archivo.contenido, archivo.usuarioId, archivo.fechaCorte, archivo.fondoCodigo ?? null);
  const analisis = analizarCertificacion(archivo.contenido, isoDia(archivo.fechaCorte));
  if (!analisis.ok) return registrarRechazo(db, base, 0, analisis.errores);
  const n = analisis.valor.registros.length;
  const calendario = await leerCalendarioCorte(db);
  const creadoEn = analisis.valor.creadoEn;
  const fecha = validarFechaCorte(archivo.fechaCorte, { ...calendario, hoy: archivo.hoy ?? new Date(), creadoEn });
  if (fecha) return registrarRechazo(db, base, n, [documento(fecha)], await pistaDeFecha(db, fecha, creadoEn, calendario, base.sha256));
  for (let intento = 1; ; intento += 1) {
    try {
      return await enTransaccion(db, base, analisis.valor, llavero, calendario);
    } catch (e) {
      // Otro importador creó la misma especie a la vez (P2002): se relee y se reintenta una sola vez.
      if (esErrorPrisma(e, CODIGO_UNICIDAD) && intento < MAX_INTENTOS) continue;
      return registrarRechazo(db, base, n, [errorDe(e)], e instanceof ErrorCorte && e.pista !== null ? { pistaCorte: e.pista } : {});
    }
  }
}
