/**
 * El nivel y la cantidad de la base, escritos como los lee la ficha (es-CO: «.» de miles y «,» decimal), para precargar
 * el formulario del plan. Sin punto flotante: ida y vuelta exacta con `leerMontoEs` y `leerEnteroEs`. Puro.
 */
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
const MILES = /\B(?=(\d{3})+(?!\d))/g;

const conMiles = (entero: string): string => entero.replace(/^0+(?=\d)/, "").replace(MILES, ".");

/** «1237.500000» → «1.237,5»; lo que no es decimal canónico sin signo → «» (no se precarga basura). */
export function nivelEs(decimal: string): string {
  const m = DECIMAL.exec(decimal);
  if (!m) return "";
  const fraccion = (m[2] ?? "").replace(/0+$/, "");
  return fraccion ? `${conMiles(m[1]!)},${fraccion}` : conMiles(m[1]!);
}

/** 4613n → «4.613». */
export const cantidadEs = (v: bigint): string => conMiles(v.toString());
