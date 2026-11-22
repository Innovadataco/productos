/** Esqueleto (rojo): patrones de texto. */
import type { Cercania, Direccion, Frescura } from "../contrato";

export type FormaDelTexto = "PLEGADO" | "MINUSCULAS";
export interface Patron {
  readonly id: string;
  readonly patron: RegExp;
  readonly sobre: FormaDelTexto;
}
export type MarcaDelHecho =
  | { readonly campo: "direccion"; readonly valor: Exclude<Direccion, "NO_APLICA"> }
  | { readonly campo: "cercania"; readonly valor: Exclude<Cercania, "NO_APLICA"> }
  | { readonly campo: "frescura"; readonly valor: Extract<Frescura, "HOY"> };
export interface PatronMarca extends Patron {
  readonly marca: MarcaDelHecho;
}
export function coincidencias(_texto: string, _patrones: readonly Patron[]): readonly string[] {
  throw new Error("SIN_IMPLEMENTAR");
}
