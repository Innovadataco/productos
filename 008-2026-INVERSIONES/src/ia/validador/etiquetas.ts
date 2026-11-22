/** Esqueleto (rojo): palabras clave de las etiquetas. */
import type { ClaveHecho } from "../catalogo";
import type { TipoResumen } from "../contrato";

export const PALABRAS_VACIAS: readonly string[] = Object.freeze([]);
export function palabrasClave(_etiqueta: string): readonly string[] {
  throw new Error("SIN_IMPLEMENTAR");
}
export function raicesDe(_palabras: readonly string[]): readonly string[] {
  throw new Error("SIN_IMPLEMENTAR");
}
export function claveCoincide(_tipo: TipoResumen, _clave: ClaveHecho, _raices: ReadonlySet<string>): boolean {
  throw new Error("SIN_IMPLEMENTAR");
}
