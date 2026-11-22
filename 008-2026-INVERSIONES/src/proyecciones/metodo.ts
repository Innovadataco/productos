/**
 * Constantes del método de proyección (decididas en el plan del frente proyecciones-motor). Puro.
 * - Bootstrap circular de bloque fijo: cada trayectoria encadena bloques de BLOQUE ruedas consecutivas de la historia,
 *   tomando el MISMO día para todas las posiciones (conserva la correlación entre especies) y días seguidos (conserva
 *   la volatilidad agrupada). Inicio uniforme; al pasar el último día vuelve al primero.
 * - Una posición entra en la historia con al menos MINIMO_DIAS días hábiles con cierre propio (≈ un año de la BVC,
 *   un ciclo de dividendos); con menos queda fija en su valor de hoy, marcada y visible.
 */

/** Ruedas por bloque (≈ un mes bursátil). */
export const BLOQUE = 20;
/** Días hábiles con cierre propio para proyectar una posición. */
export const MINIMO_DIAS = 250;
/** Un factor diario fuera de [SALTO_MIN, SALTO_MAX] sin escisión que lo explique se toma como evento no registrado. */
export const SALTO_MIN = 0.5;
export const SALTO_MAX = 2;
/** Días calendario antes de un pago SIN decreto en que la tenencia debe quedar quieta (la misma aproximación de la fecha
 * ex que usa src/plan/dividendos.ts; una prueba fija que coincidan). Con decreto manda su fecha ex. */
export const VENTANA_EX_DIAS = 10;
/** Años de historia que se leen como máximo. */
export const ANIOS_HISTORIA_MAX = 10;
/** Tope de trabajo por pedido: trayectorias × meses (dos veces 5000 × 120). */
export const MAX_TRABAJO = 1_200_000;
/** Tope del costo real (trayectorias × ruedas del horizonte × posiciones proyectadas): 5000 × 10 años × 13 posiciones son
 * ≈ 164 millones de pasos y tardan ≈ 0,36 s en el Mac; el tope deja ≈ 1 s. Lo aplica `simular` (el portafolio fija K). */
export const MAX_PASOS = 400_000_000;
export const MAX_TRAYECTORIAS = 10_000;
export const MAX_HORIZONTE_MESES = 360;
export const MAX_APORTE = 1e12;
export const MAX_CAIDA_PCT = 99;
export const MAX_SEMILLA = 4_294_967_295;
/** Días por mes para fechar la ventana (año juliano / 12). */
export const DIAS_POR_MES = 365.25 / 12;
/** Tolerancia relativa al comparar el valor final con lo aportado (ruido de coma flotante). */
export const TOLERANCIA_RELATIVA = 1e-9;
/** Cambia si cambia el método: la pantalla lo muestra y permite comparar resultados. v2: los pagos de Trii con decreto
 * se miden con su fecha ex, como el plan (src/proyecciones/dividendos.ts); sin decretos, los números son los de la v1. */
export const VERSION_METODO = "bootstrap-circular-v2";
