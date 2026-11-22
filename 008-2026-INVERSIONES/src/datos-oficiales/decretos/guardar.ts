/** Camino único de escritura de dividendo_decretado (fase C, C4a). PENDIENTE (rojo de C4a). */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Llavero } from "../../cifrado/llavero";
import type { Hallazgo } from "../registro/hallazgos";
import type { FilaDecreto } from "./csv";
import type { DecretoLeido, TipoDecreto } from "./filas";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export const TIPO_FUENTE = "REGISTRO_DECRETOS" as const;

export type CodigoDecretos = "CRUCE_PENDIENTE" | "CADENA_ROTA" | "ANULACION_SIN_DECRETO" | "CONFLICTO_CONCURRENTE";

export class ErrorDecretos extends Error {
  constructor(readonly codigo: CodigoDecretos, readonly linea = 0) {
    super(codigo);
    this.name = "ErrorDecretos";
  }
}

export interface VersionGuardada {
  readonly id: string;
  readonly instrumentoId: string;
  readonly tipo: TipoDecreto;
  readonly fechaAnuncio: Date;
  readonly cuota: number;
  readonly version: number;
  readonly vigente: boolean;
  readonly valorPorAccion: Prisma.Decimal;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
  readonly referenciaOficial: string;
  readonly nota: string | null;
  readonly anulada: boolean;
  readonly filaFuenteId: string;
}

export interface DecretoResuelto {
  readonly fila: FilaDecreto;
  readonly instrumentoId: string;
}

export type Plan =
  | { readonly accion: "NUEVO"; readonly version: 1 }
  | { readonly accion: "NUEVA_VERSION"; readonly version: number; readonly retirarId: string }
  | { readonly accion: "SIN_CAMBIOS"; readonly filaFuenteId: string }
  | { readonly accion: "RECHAZO"; readonly codigo: "CADENA_ROTA" | "ANULACION_SIN_DECRETO" };

export interface Planificado {
  readonly resuelto: DecretoResuelto;
  readonly plan: Exclude<Plan, { readonly accion: "RECHAZO" }>;
}

export interface ConteosDecretos {
  readonly filas: number;
  readonly nuevos: number;
  readonly versiones: number;
  readonly anulaciones: number;
  readonly sinCambios: number;
}

const pendiente = (): never => {
  throw new Error("PENDIENTE");
};

export const claveDecreto = (_instrumentoId: string, _tipo: TipoDecreto, _fechaAnuncio: Date, _cuota: number): string => pendiente();
export const claveNaturalDecreto = (_instrumentoId: string, _d: Pick<DecretoLeido, "tipo" | "fechaAnuncio" | "cuota">, _version: number): string => pendiente();
export const mismoContenido = (_v: VersionGuardada, _d: DecretoLeido): boolean => pendiente();
export const planificar = (_versiones: readonly VersionGuardada[], _d: DecretoLeido): Plan => pendiente();
export const planificarTodos = (
  _resueltos: readonly DecretoResuelto[], _versiones: ReadonlyMap<string, readonly VersionGuardada[]>,
): { readonly planes: readonly Planificado[]; readonly hallazgos: readonly Hallazgo[] } => pendiente();
export const contar = (_planes: readonly Planificado[]): ConteosDecretos => pendiente();
export const hayCambios = (_c: ConteosDecretos): boolean => pendiente();
export const leerVersiones = async (_db: Db, _ids: readonly string[]): Promise<ReadonlyMap<string, readonly VersionGuardada[]>> => pendiente();
export const basePermiteAplicar = (_nombre: string): boolean => pendiente();
export const nombreDeLaBase = async (_db: Db): Promise<string> => pendiente();

export interface EntradaGuardar {
  readonly usuarioId: string;
  readonly nombreArchivo: string;
  readonly sha256: string;
  readonly resueltos: readonly DecretoResuelto[];
  readonly llavero: Llavero;
}

export type ResultadoGuardar =
  | { readonly estado: "APLICADO"; readonly cargaId: string; readonly conteos: ConteosDecretos }
  | { readonly estado: "SIN_CAMBIOS"; readonly conteos: ConteosDecretos }
  | { readonly estado: "RECHAZADO"; readonly hallazgos: readonly Hallazgo[] };

export const guardarDecretos = async (_db: PrismaClient, _e: EntradaGuardar): Promise<ResultadoGuardar> => pendiente();
