/**
 * Escritura de una carga del registro del dueño (fase C: decretos, C4a), siempre dentro de la transacción de quien la
 * llama: el candado de su tipo de fuente, la carga (carga_archivo), cada fila nueva con su crudo cifrado (fila_fuente,
 * #11) y qué carga vio qué fila (fila_de_carga). fila_fuente y fila_de_carga son de solo inserción: aquí solo se crean.
 * El hecho lo escribe el camino único de su tabla (los decretos: src/datos-oficiales/decretos/guardar.ts).
 */
import type { Prisma, TipoFuente } from "@prisma/client";
import { cifrarCrudo, type Crudo } from "../../cifrado/campos";
import type { Llavero } from "../../cifrado/llavero";

type Tx = Prisma.TransactionClient;

/** Una carga del mismo tipo de fuente a la vez; la misma forma de clave que las cargas de Trii (inv008-importar-<tipo>). */
export async function tomarCandado(tx: Tx, tipoFuente: TipoFuente): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inv008-importar-${tipoFuente}`}))`;
}

export interface DatosCarga {
  readonly tipoFuente: TipoFuente;
  readonly nombreArchivo: string;
  readonly sha256: string;
  readonly usuarioId: string;
  readonly filasTotal: number;
  readonly filasNuevas: number;
  readonly filasRepetidas: number;
}

/** La carga nace CARGADO: quien llama ya sabe qué va a escribir y lo escribe en la misma transacción (o no queda nada). */
export async function crearCarga(tx: Tx, d: DatosCarga): Promise<string> {
  const { id } = await tx.cargaArchivo.create({
    data: {
      tipoFuente: d.tipoFuente, nombreArchivo: d.nombreArchivo, sha256: d.sha256, estado: "CARGADO",
      filasTotal: d.filasTotal, filasNuevas: d.filasNuevas, filasRepetidas: d.filasRepetidas, cargadoPorId: d.usuarioId,
    },
    select: { id: true },
  });
  return id;
}

export interface FilaCruda {
  readonly cargaId: string;
  readonly tipoFuente: TipoFuente;
  readonly claveNatural: string;
  readonly filaNo: number;
  readonly crudo: Crudo;
}

/** Que esta carga vio una fila que ya estaba: reimportar no duplica, pero deja registro. */
export async function verFila(tx: Tx, cargaId: string, filaNo: number, filaFuenteId: string): Promise<void> {
  await tx.filaDeCarga.create({ data: { cargaId, filaNo, filaFuenteId } });
}

/** Una fila nueva: su crudo cifrado y atado a su llave natural (ocurrencia 1), y que esta carga la vio. Devuelve su id. */
export async function guardarFilaCruda(tx: Tx, f: FilaCruda, llavero: Llavero): Promise<string> {
  const llave = { tipoFuente: f.tipoFuente, claveNatural: f.claveNatural, ocurrencia: 1 };
  const crudo = cifrarCrudo(f.crudo, llave, llavero);
  const { id } = await tx.filaFuente.create({ data: { ...llave, primeraCargaId: f.cargaId, primeraFilaNo: f.filaNo, crudo }, select: { id: true } });
  await verFila(tx, f.cargaId, f.filaNo, id);
  return id;
}
