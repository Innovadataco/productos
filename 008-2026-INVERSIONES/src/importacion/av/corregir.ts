/**
 * Corrige el corte de una certificación de A&V ya cargada con el corte equivocado (frente certificacion-corte-real):
 * el camino ÚNICO (candado: tests/unit/importacion/av/camino-correccion.test.ts), con el MISMO PDF y en UNA sola
 * transacción. Mover la fecha no se puede (la FK compuesta de conciliacion es ON UPDATE RESTRICT y la clave natural y
 * el crudo cifrado de cada fila llevan la fecha), así que:
 *   1. toma el candado de las importaciones y los de conciliar de los dos cortes (en orden fijo);
 *   2. exige una certificación VIGENTE en el corte viejo, cargada con ESE archivo (sha256), y el corte nuevo libre;
 *   3. valida el corte nuevo como una importación (día hábil, no futuro, CreationDate del PDF y señal 1 de precios);
 *   4. importa el PDF con el corte nuevo por el camino de siempre (`nueva`: filas, posiciones, fondo cifrado);
 *   5. retira la vieja (retiradaEn + reemplazadaPorId) y pasa a REVERTIDO todas sus cargas (la primera y las
 *      repetidas), con quién y cuándo; la base lo vigila (migración 20261122010000_certificacion_retiro);
 *   6. re-verifica los cierres de los dos días (`reverificarCierres`: los del viejo quedan sin referencia y los del
 *      nuevo, contra la certificación) y cuenta cuántos cambiaron.
 * Nada se borra: la certificación retirada, sus filas, su carga y sus conciliaciones quedan como historia. Si algo
 * falla, no cambia nada y queda una carga RECHAZADO con el código (como en la importación). El siguiente paso, que no
 * corre aquí, es conciliar el corte nuevo.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { obtenerLlavero, type Llavero } from "../../cifrado/llavero";
import { candadoConciliar } from "../../lib/candados";
import { corteOcupado } from "../../conciliacion/vigente";
import { reverificarCierres } from "../../precios/guardar";
import { analizarCertificacion, errorDeDocumento, type CertificacionAnalizada } from "./analisis";
import { isoDia, leerCalendarioCorte, validarFechaCorte, type CalendarioCorte, type PistaCorte } from "./fecha-corte";
import { ErrorImportacionAv, TIPO_FUENTE } from "./guardar";
import { CANDADO_IMPORTAR, ErrorCorte, baseDe, errorDe, exigirCorteReal, nueva, pistaPorPdf, registrarRechazo, type Base } from "./importar";

export interface CorreccionCorte {
  readonly contenido: Uint8Array;
  readonly usuarioId: string;
  /** El corte con que se cargó (el equivocado). */
  readonly fechaCorte: Date;
  /** El corte real. */
  readonly nuevaFechaCorte: Date;
  /** Reloj inyectable (pruebas). */
  readonly hoy?: Date;
}

export interface ResultadoCorreccion {
  readonly estado: "CORREGIDO" | "RECHAZADO";
  /** null si se corrigió; si no, el código del rechazo. */
  readonly codigo: string | null;
  /** Si el corte nuevo tampoco es el real: el día que se sugiere y por qué. */
  readonly pistaCorte: PistaCorte | null;
  readonly retiradaId: string | null;
  readonly nuevaId: string | null;
  /** La carga nueva (CORREGIDO) o la carga RECHAZADO que deja constancia. */
  readonly cargaId: string | null;
  readonly filas: number;
  readonly cargasRevertidas: number;
  /** Cierres re-verificados: del corte viejo (`anterior`) y del nuevo. */
  readonly reverificados: { readonly anterior: number; readonly nuevo: number };
}

export interface DependenciasCorreccion {
  readonly reverificar: (tx: Prisma.TransactionClient, fechas: readonly Date[]) => Promise<number[]>;
}

const DEPENDENCIAS: DependenciasCorreccion = { reverificar: reverificarCierres };

interface Contexto {
  readonly c: CorreccionCorte;
  readonly base: Base;
  readonly analizada: CertificacionAnalizada;
  readonly llavero: Llavero;
  readonly calendario: CalendarioCorte;
  readonly deps: DependenciasCorreccion;
}

/** Pasos 1 a 3: los candados y todo lo que debe cumplirse antes de escribir. Devuelve la certificación vieja. */
async function exigir(tx: Prisma.TransactionClient, x: Contexto): Promise<{ id: string }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CANDADO_IMPORTAR}))`;
  for (const d of [isoDia(x.c.fechaCorte), isoDia(x.c.nuevaFechaCorte)].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candadoConciliar(d)}))`;
  const vieja = await corteOcupado(tx, x.c.fechaCorte);
  if (!vieja) throw new ErrorImportacionAv("SIN_CERTIFICACION");
  if (vieja.reemplazo !== null) throw new ErrorImportacionAv("CORTE_RETIRADO");
  const carga = await tx.cargaArchivo.findUniqueOrThrow({ where: { id: vieja.cargaId }, select: { sha256: true, tipoFuente: true } });
  if (carga.tipoFuente !== TIPO_FUENTE || carga.sha256 !== x.base.sha256) throw new ErrorImportacionAv("ARCHIVO_DISTINTO");
  const enOtroCorte = await tx.cargaArchivo.findFirst({ where: { tipoFuente: TIPO_FUENTE, sha256: x.base.sha256, estado: "CARGADO", NOT: { fechaCorte: x.c.fechaCorte } }, select: { id: true } });
  if (enOtroCorte) throw new ErrorImportacionAv("ARCHIVO_YA_CARGADO");
  if (await corteOcupado(tx, x.c.nuevaFechaCorte)) throw new ErrorImportacionAv("CORTE_OCUPADO");
  const fecha = validarFechaCorte(x.c.nuevaFechaCorte, { ...x.calendario, hoy: x.c.hoy ?? new Date(), creadoEn: x.analizada.creadoEn });
  if (fecha) throw new ErrorCorte(fecha, pistaPorPdf(fecha, x.analizada.creadoEn, x.calendario));
  await exigirCorteReal(tx, x.c.nuevaFechaCorte, x.analizada, x.calendario);
  return vieja;
}

/** Los seis pasos, en la transacción. */
async function corregirEn(tx: Prisma.TransactionClient, x: Contexto): Promise<ResultadoCorreccion> {
  const vieja = await exigir(tx, x);
  const importada = await nueva(tx, x.base, x.analizada, x.llavero);
  const ahora = new Date();
  await tx.certificacion.update({ where: { id: vieja.id }, data: { retiradaEn: ahora, reemplazadaPorId: importada.certificacionId } });
  const { count } = await tx.cargaArchivo.updateMany({
    where: { tipoFuente: TIPO_FUENTE, sha256: x.base.sha256, fechaCorte: x.c.fechaCorte, estado: "CARGADO" },
    data: { estado: "REVERTIDO", revertidaEn: ahora, revertidaPorId: x.c.usuarioId },
  });
  const [anterior = 0, nuevo = 0] = await x.deps.reverificar(tx, [x.c.fechaCorte, x.c.nuevaFechaCorte]);
  return {
    estado: "CORREGIDO", codigo: null, pistaCorte: null, retiradaId: vieja.id, nuevaId: importada.certificacionId, cargaId: importada.cargaId,
    filas: importada.filasTotal, cargasRevertidas: count, reverificados: { anterior, nuevo },
  };
}

const NADA = { retiradaId: null, nuevaId: null, filas: 0, cargasRevertidas: 0, reverificados: { anterior: 0, nuevo: 0 } } as const;

/** Deja la carga RECHAZADO (con el corte nuevo) y devuelve el rechazo. */
async function rechazar(db: PrismaClient, base: Base, filas: number, error: ReturnType<typeof errorDe>, pista: PistaCorte | null): Promise<ResultadoCorreccion> {
  const r = await registrarRechazo(db, base, filas, [error], pista === null ? {} : { pistaCorte: pista });
  return { ...NADA, estado: "RECHAZADO", codigo: error.codigo, pistaCorte: pista, cargaId: r.cargaId };
}

const pistaDe = (e: unknown): PistaCorte | null => (e instanceof ErrorCorte ? e.pista : null);

export async function corregirCorteCertificacion(db: PrismaClient, c: CorreccionCorte, deps: DependenciasCorreccion = DEPENDENCIAS): Promise<ResultadoCorreccion> {
  const llavero = obtenerLlavero(); // primero: sin claves no se escribe nada, ni el rechazo
  const usuario = await db.usuario.findUnique({ where: { id: c.usuarioId }, select: { activo: true, rol: true } });
  if (!usuario || !usuario.activo || usuario.rol !== "DUENO") throw new ErrorImportacionAv("USUARIO_NO_AUTORIZADO");
  const base = baseDe(c.contenido, c.usuarioId, c.nuevaFechaCorte, null);
  if (isoDia(c.fechaCorte) === isoDia(c.nuevaFechaCorte)) return rechazar(db, base, 0, errorDeDocumento("MISMA_FECHA"), null);
  const analisis = analizarCertificacion(c.contenido, isoDia(c.nuevaFechaCorte));
  if (!analisis.ok) return rechazar(db, base, 0, analisis.errores[0]!, null);
  const x: Contexto = { c, base, analizada: analisis.valor, llavero, calendario: await leerCalendarioCorte(db), deps };
  try {
    return await db.$transaction((tx) => corregirEn(tx, x), { timeout: 60_000, maxWait: 10_000 });
  } catch (e) {
    return rechazar(db, base, analisis.valor.registros.length, errorDe(e), pistaDe(e));
  }
}
