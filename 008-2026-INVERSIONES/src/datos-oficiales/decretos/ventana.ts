/** Ventana del cruce de un decreto con los pagos de Trii (fase C, C5b). Stub del rojo: lanza PENDIENTE. */
import { sumarDias } from "../../plan/fechas";

export const VENTANA_PAGO_ANTES_DIAS = 3;
export const VENTANA_PAGO_DESPUES_DIAS = 10;

const pendiente = (): never => {
  throw new Error("PENDIENTE");
};
export const inicioVentana = (fechaPago: Date): Date => (fechaPago ? pendiente() : sumarDias(fechaPago, 0));
export const finVentana = (_fechaPago: Date): Date => pendiente();
export const enVentanaDePago = (_fechaPagoDecreto: Date, _fechaPagoTrii: Date): boolean => pendiente();
