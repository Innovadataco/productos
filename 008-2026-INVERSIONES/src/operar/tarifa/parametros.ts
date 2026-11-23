/**
 * Las listas y los límites de la tarifa de comisión (O5), en un solo lugar para quien los usa. La migración
 * *_tarifa_comision los repite como CHECK y una prueba espejo los compara (tests/unit/operar/tarifa/esquema.test.ts). Puro.
 * Los que también valida el motor (comisionistas, tope de los montos, cuántos cargos y sus decimales) nacen en
 * src/operar/simulador y se re-exportan de allí: el candado de pureza del motor no le deja importar fuera de su carpeta,
 * así que la dependencia va de la tarifa al motor y no al revés (una sola definición de cada uno).
 */
export { COMISIONISTAS, type Comisionista } from "../simulador/tipos";
export { DECIMALES_TARIFA, MAX_OTROS_CARGOS, TOPE_CARGO_TARIFA } from "../simulador/validar";

/** Los dos lados de una orden, en el orden del formulario. */
export const LADOS_TARIFA = ["COMPRA", "VENTA"] as const;
export const TIPOS_CARGO = ["PCT", "FIJO"] as const;
/** Porcentaje e IVA: de 0 a 100. */
export const MAX_PORCENTAJE = "100";
/** Decimales del IVA (la columna es DECIMAL(5,2)). */
export const DECIMALES_IVA = 2;
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
