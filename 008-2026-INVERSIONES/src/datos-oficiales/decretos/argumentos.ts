/** Argumentos de scripts/importar-decretos.ts (fase C, C4a). PENDIENTE (rojo de C4a). */
import type { OpcionesSalida, SalidaCli } from "../registro/reporte";

export const USO_IMPORTAR_DECRETOS = "PENDIENTE";
export const USO_VIA_B_DECRETOS = "PENDIENTE";

export type CodigoArgumentos = "ARGUMENTOS_INVALIDOS" | "OPCION_REPETIDA" | "FALTA_ARCHIVO" | "ARCHIVO_NO_CSV" | "FALTA_EMAIL" | "EMAIL_INVALIDO";

export type ArgumentosDecretos =
  | { readonly ok: true; readonly archivo: string; readonly email: string; readonly aplicar: boolean }
  | { readonly ok: false; readonly codigo: CodigoArgumentos };

export function leerArgumentosDecretos(_argv: readonly string[]): ArgumentosDecretos {
  throw new Error("PENDIENTE");
}

export function salidaUso(_codigo: CodigoArgumentos, _o: OpcionesSalida): SalidaCli {
  throw new Error("PENDIENTE");
}
