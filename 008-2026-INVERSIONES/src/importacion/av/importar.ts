/**
 * Importa la certificación PDF de Acciones & Valores de forma atómica (PR-B del hito 1).
 * - Sin un llavero válido falla cerrado (ErrorCifrado) antes de tocar la base: no queda ni la carga rechazada.
 * - Solo el DUENO activo importa.
 * - Una fila inválida, una fecha de corte inválida, un conflicto o un fallo de la base → la carga queda RECHAZADA
 *   (con códigos y ubicaciones, nunca valores) y no se guarda ningún hecho.
 * - Reimportar el mismo PDF con la misma fecha no duplica: carga CARGADO «repetida», 0 filas nuevas.
 *   La misma fecha con otras filas es CONFLICTO_CERTIFICACION: lo importado no se edita (se revierte la carga).
 * - El mismo archivo (sha256) con otra fecha de corte es ARCHIVO_YA_CARGADO.
 * - El archivo original no se guarda: solo su sha256, un nombre fijo y las filas cifradas.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { ErrorCifrado } from "../../cifrado/errores";
import { obtenerLlavero, type Llavero } from "../../cifrado/llavero";
import { analizarCertificacion, errorDeDocumento as documento, type CertificacionAnalizada } from "./analisis";
import { aniosSembrados, isoDia, validarFechaCorte } from "./fecha-corte";
import type { ErrorFilaAv } from "./filas";
import {
  ErrorImportacionAv, TIPO_FUENTE, filasSiCoinciden, guardarCertificacion, guardarFilas, registrarVistas, resolverEspecies, resolverFondos,
} from "./guardar";
import { MAX_BYTES } from "./pdf/documento";

export const MAX_ERRORES_REGISTRADOS = 100;
const MAX_INTENTOS = 2;
const esChoque = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
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
}

const sinNada = { repetida: false, certificacionId: null, filasNuevas: 0, filasRepetidas: 0, instrumentosCreados: 0, fondoVinculado: false } as const;

async function registrarRechazo(db: PrismaClient, base: Base, filasTotal: number, errores: readonly ErrorFilaAv[]): Promise<ResultadoImportacionAv> {
  const registrados = errores.slice(0, MAX_ERRORES_REGISTRADOS);
  const carga = await db.cargaArchivo.create({
    data: {
      tipoFuente: TIPO_FUENTE, nombreArchivo: base.nombre, sha256: base.sha256, fechaCorte: base.fecha, estado: "RECHAZADO", filasTotal,
      errores: { total: errores.length, errores: registrados } as unknown as Prisma.InputJsonValue, cargadoPorId: base.usuarioId,
    },
  });
  return { ...sinNada, cargaId: carga.id, estado: "RECHAZADO", filasTotal, errores: registrados };
}

interface Base {
  readonly usuarioId: string;
  readonly sha256: string;
  readonly fecha: Date;
  readonly nombre: string;
  readonly fondoCodigo: string | null;
}

async function contextoCalendario(db: PrismaClient) {
  const noHabiles = (await db.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } })).map((c) => c.dia);
  return { noHabiles: new Set(noHabiles.map(isoDia)), aniosSembrados: aniosSembrados(noHabiles) };
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

async function nueva(tx: Prisma.TransactionClient, base: Base, a: CertificacionAnalizada, llavero: Llavero): Promise<ResultadoImportacionAv> {
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

async function enTransaccion(db: PrismaClient, base: Base, a: CertificacionAnalizada, llavero: Llavero): Promise<ResultadoImportacionAv> {
  return db.$transaction(
    async (tx) => {
      // Una sola importación de certificaciones a la vez: el chequeo de sha256 y de fecha no tiene carreras.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inv008-importar-${TIPO_FUENTE}`}))`;
      const mismoArchivo = await tx.cargaArchivo.findFirst({ where: { tipoFuente: TIPO_FUENTE, sha256: base.sha256, estado: "CARGADO", NOT: { fechaCorte: base.fecha } }, select: { id: true } });
      if (mismoArchivo) throw new ErrorImportacionAv("ARCHIVO_YA_CARGADO");
      const existente = await tx.certificacion.findUnique({ where: { fechaCorte: base.fecha }, select: { id: true, cargaId: true } });
      return existente ? repetida(tx, base, a, existente, llavero) : nueva(tx, base, a, llavero);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** Código del fallo, sin el mensaje (el de Prisma puede traer valores). P2028 = transacción vencida. */
function errorDe(e: unknown): ErrorFilaAv {
  if (e instanceof ErrorImportacionAv) return { ...e.ubicacion, codigo: e.codigo };
  if (e instanceof ErrorCifrado) return documento(e.codigo);
  if (e instanceof Prisma.PrismaClientKnownRequestError) return documento(e.code === "P2028" ? "TIEMPO_AGOTADO" : `BASE_${e.code}`);
  return documento("BASE_ERROR");
}

export async function importarCertificacion(db: PrismaClient, archivo: ArchivoCertificacion): Promise<ResultadoImportacionAv> {
  const llavero = obtenerLlavero(); // primero: sin claves no se escribe nada, ni el rechazo
  const usuario = await db.usuario.findUnique({ where: { id: archivo.usuarioId }, select: { activo: true, rol: true } });
  if (!usuario || !usuario.activo || usuario.rol !== "DUENO") throw new ErrorImportacionAv("USUARIO_NO_AUTORIZADO");
  const dia = isoDia(archivo.fechaCorte);
  const base: Base = {
    usuarioId: archivo.usuarioId, sha256: createHash("sha256").update(archivo.contenido).digest("hex"), fecha: archivo.fechaCorte,
    nombre: `certificacion-av-${dia}.pdf`, fondoCodigo: archivo.fondoCodigo ?? null,
  };
  const analisis = analizarCertificacion(archivo.contenido, dia);
  if (!analisis.ok) return registrarRechazo(db, base, 0, analisis.errores);
  const n = analisis.valor.registros.length;
  const fecha = validarFechaCorte(archivo.fechaCorte, { ...(await contextoCalendario(db)), hoy: archivo.hoy ?? new Date(), creadoEn: analisis.valor.creadoEn });
  if (fecha) return registrarRechazo(db, base, n, [documento(fecha)]);
  for (let intento = 1; ; intento += 1) {
    try {
      return await enTransaccion(db, base, analisis.valor, llavero);
    } catch (e) {
      // Otro importador creó la misma especie a la vez (P2002): se relee y se reintenta una sola vez.
      if (esChoque(e) && intento < MAX_INTENTOS) continue;
      return registrarRechazo(db, base, n, [errorDe(e)]);
    }
  }
}
