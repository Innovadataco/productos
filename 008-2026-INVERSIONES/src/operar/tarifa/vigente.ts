/**
 * La tarifa que rige (O5): la de mayor versión, de ese comisionista y ese lado, con «vigente desde» hasta el día.
 * Una con fecha futura todavía no rige. Puro.
 */
import type { LadoOrden } from "@prisma/client";
import type { Comisionista, TarifaSimulada, TarifasVigentes } from "../simulador/tipos";

export function vigenteDe<T extends TarifaSimulada>(tarifas: readonly T[], comisionista: Comisionista, lado: LadoOrden, dia: Date): T | undefined {
  return tarifas
    .filter((t) => t.comisionista === comisionista && t.lado === lado && t.vigenteDesde.getTime() <= dia.getTime())
    .reduce<T | undefined>((mejor, t) => (mejor === undefined || t.version > mejor.version ? t : mejor), undefined);
}

/** Las vigentes de un comisionista en el día, por lado (sin la de un lado, ese lado no lleva clave). */
export function vigentesDe(tarifas: readonly TarifaSimulada[], comisionista: Comisionista, dia: Date): TarifasVigentes {
  const compra = vigenteDe(tarifas, comisionista, "COMPRA", dia);
  const venta = vigenteDe(tarifas, comisionista, "VENTA", dia);
  return { ...(compra ? { COMPRA: compra } : {}), ...(venta ? { VENTA: venta } : {}) };
}
