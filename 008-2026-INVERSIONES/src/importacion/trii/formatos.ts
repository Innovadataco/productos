/** Formatos de los CSV de Trii verificados el 2026-11-20 (CONTEXTO de 008). Encabezados exactos. */
export type TipoTrii = "TRII_CAJA" | "TRII_ORDENES" | "TRII_DIVIDENDOS";

export const ENCABEZADOS: Readonly<Record<TipoTrii, readonly string[]>> = {
  TRII_CAJA: ["Fecha y hora", "Tipo de movimiento", "Estado", "Valor total"],
  TRII_ORDENES: [
    "Fecha y hora",
    "Símbolo de la acción",
    "Tipo de orden",
    "Estado",
    "Acciones completadas",
    "Acciones pendientes",
    "Precio por acción",
    "Total invertido",
    "Valor comisión",
    "Total estimado",
  ],
  TRII_DIVIDENDOS: ["Fecha y hora", "Ticker", "Estado", "Valor total"],
};

const normalizar = (s: string) => s.normalize("NFC").replace(/[  ]/g, " ").trim();

/** Reconoce el tipo de archivo por su encabezado exacto (en orden). Null si no es de Trii. */
export function detectarTipo(encabezado: readonly string[]): TipoTrii | null {
  const recibido = encabezado.map(normalizar);
  for (const [tipo, esperado] of Object.entries(ENCABEZADOS) as [TipoTrii, readonly string[]][]) {
    if (recibido.length === esperado.length && esperado.every((col, i) => recibido[i] === col)) return tipo;
  }
  return null;
}
