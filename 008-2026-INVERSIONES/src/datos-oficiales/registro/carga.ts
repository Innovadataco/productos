/** Escritura de una carga del registro del dueño (fase C: decretos, C4a). PENDIENTE (rojo de C4a). */
import type { Prisma, TipoFuente } from "@prisma/client";
import type { Crudo } from "../../cifrado/campos";
import type { Llavero } from "../../cifrado/llavero";

type Tx = Prisma.TransactionClient;

export async function tomarCandado(_tx: Tx, _tipoFuente: TipoFuente): Promise<void> {
  throw new Error("PENDIENTE");
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

export async function crearCarga(_tx: Tx, _d: DatosCarga): Promise<string> {
  throw new Error("PENDIENTE");
}

export interface FilaCruda {
  readonly cargaId: string;
  readonly tipoFuente: TipoFuente;
  readonly claveNatural: string;
  readonly filaNo: number;
  readonly crudo: Crudo;
}

export async function verFila(_tx: Tx, _cargaId: string, _filaNo: number, _filaFuenteId: string): Promise<void> {
  throw new Error("PENDIENTE");
}

export async function guardarFilaCruda(_tx: Tx, _f: FilaCruda, _llavero: Llavero): Promise<string> {
  throw new Error("PENDIENTE");
}
