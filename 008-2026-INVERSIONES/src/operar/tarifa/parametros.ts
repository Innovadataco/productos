/**
 * Las listas y los límites de la tarifa de comisión (O5), en un solo lugar. La migración *_tarifa_comision los repite
 * como CHECK y una prueba espejo los compara (tests/unit/operar/tarifa/esquema.test.ts). Puro.
 */
export { COMISIONISTAS, type Comisionista } from "../simulador/tipos";
export { MAX_OTROS_CARGOS, TOPE_CARGO_TARIFA } from "../simulador/validar";

/** Los dos lados de una orden, en el orden del formulario. */
export const LADOS_TARIFA = ["COMPRA", "VENTA"] as const;
export const TIPOS_CARGO = ["PCT", "FIJO"] as const;
/** Porcentaje e IVA: de 0 a 100. */
export const MAX_PORCENTAJE = "100";
/** Decimales de los porcentajes, los montos y los cargos (la escala de la tabla y de `orden.comision`). */
export const DECIMALES_TARIFA = 4;
export const MAX_NOMBRE_CARGO = 60;
export const MAX_MOTIVO = 2000;
/** Una tarifa no rige a más de un año de hoy (un error de tipeo en el año, no una tarifa real). */
export const DIAS_MAX_ADELANTE = 366;
/**
 * Tolerancia del control «la tarifa explica X de N órdenes»: la comisión calculada y la real de `orden.comision`
 * pueden diferir hasta 1 peso por orden. La casa de bolsa redondea a pesos (008 calcula con 4 decimales) y el IVA
 * redondeado aparte puede sumar otro centavo: más de 1 peso ya no es redondeo, es otra tarifa.
 */
export const TOLERANCIA_CONTROL_PESOS = "1";
