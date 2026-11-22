/** Esqueleto (rojo): lectura de la salida cruda. */
export interface FraseLeida {
  readonly texto: string;
  readonly hechos: readonly string[];
}
export interface SalidaLeida {
  readonly frases: readonly FraseLeida[];
}
export function leerSalida(_salidaCruda: unknown): SalidaLeida | null {
  throw new Error("SIN_IMPLEMENTAR");
}
