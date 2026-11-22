/** importar-decretos (fase C, C4a). PENDIENTE (rojo de C4a). */
import type { PrismaClient } from "@prisma/client";
import type { Llavero } from "../../cifrado/llavero";
import type { Hallazgo } from "../registro/hallazgos";
import type { OpcionesSalida, SalidaCli } from "../registro/reporte";
import type { ConteosDecretos } from "./guardar";

export interface EntradaDecretos {
  readonly contenido: Uint8Array;
  readonly nombreArchivo: string;
  readonly email: string;
  readonly aplicar: boolean;
}

export interface OpcionesDecretos {
  readonly ahora?: Date;
  readonly llavero?: Llavero;
}

export type ModoDecretos = "ENSAYO" | "APLICAR";

export type ResultadoDecretos =
  | { readonly modo: ModoDecretos; readonly estado: "RECHAZADO"; readonly total: number; readonly hallazgos: readonly Hallazgo[] }
  | {
      readonly modo: ModoDecretos;
      readonly estado: "LISTO" | "SIN_CAMBIOS" | "APLICADO";
      readonly conteos: ConteosDecretos;
      readonly cargaId: string | null;
      readonly aplicarPermitido: boolean;
    };

export async function importarDecretos(_db: PrismaClient, _e: EntradaDecretos, _o: OpcionesDecretos = {}): Promise<ResultadoDecretos> {
  throw new Error("PENDIENTE");
}

export function salidaDecretos(_r: ResultadoDecretos, _o: OpcionesSalida): SalidaCli {
  throw new Error("PENDIENTE");
}

export function salidaArchivo(_codigo: "ARCHIVO_ILEGIBLE" | "ARCHIVO_NO_REGULAR" | "ARCHIVO_DEMASIADO_GRANDE", _o: OpcionesSalida): SalidaCli {
  throw new Error("PENDIENTE");
}
