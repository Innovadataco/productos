/**
 * Ventana del cruce de un decreto con los pagos de Trii (fase C, C5b). Pura: solo fechas.
 * Un pago de Trii cruza con un decreto de su especie si llega entre VENTANA_PAGO_ANTES_DIAS antes y
 * VENTANA_PAGO_DESPUES_DIAS después de la fecha de pago del decreto: días calendario, con los dos bordes incluidos.
 * Es una APROXIMACIÓN: cuándo acredita Trii frente a la fecha de pago del emisor está por verificar (P12). Con cuotas
 * mensuales (unos 30 días entre sí) las ventanas de una especie no se tocan; si se tocan, el cruce lo marca
 * (PAGO_EN_DISPUTA, cruce.ts). Un pago que llega después de la ventana no cruza: queda SIN_DECRETO y su decreto
 * NO_RECIBIDO, a la vista.
 * La usan el cruce (cruce.ts) y el motor de proyecciones (src/proyecciones/dividendos.ts): los dos cruzan con la misma
 * ventana (candado tests/unit/proyecciones/servidor.test.ts: el motor solo importa módulos puros).
 */
import { sumarDias } from "../../plan/fechas";

export const VENTANA_PAGO_ANTES_DIAS = 3;
export const VENTANA_PAGO_DESPUES_DIAS = 10;

export const inicioVentana = (fechaPago: Date): Date => sumarDias(fechaPago, -VENTANA_PAGO_ANTES_DIAS);
export const finVentana = (fechaPago: Date): Date => sumarDias(fechaPago, VENTANA_PAGO_DESPUES_DIAS);

/** ¿El pago de Trii del día `fechaPagoTrii` cae en la ventana del decreto con pago `fechaPagoDecreto`? */
export function enVentanaDePago(fechaPagoDecreto: Date, fechaPagoTrii: Date): boolean {
  const t = fechaPagoTrii.getTime();
  return t >= inicioVentana(fechaPagoDecreto).getTime() && t <= finVentana(fechaPagoDecreto).getTime();
}
