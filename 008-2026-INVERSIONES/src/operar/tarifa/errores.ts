/** Errores al guardar una tarifa (O5): solo un código, nunca valores. */
export type CodigoErrorTarifa = "TARIFA_CAMBIO" | "AUTOR_INEXISTENTE";

export class ErrorTarifa extends Error {
  override readonly name = "ErrorTarifa";
  constructor(readonly codigo: CodigoErrorTarifa) {
    super(codigo);
  }
}
