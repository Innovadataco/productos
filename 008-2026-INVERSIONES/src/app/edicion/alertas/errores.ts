/** Errores al guardar una versión de umbrales de las alertas: solo un código, nunca valores. */
export type CodigoErrorUmbral = "UMBRAL_CAMBIO" | "AUTOR_INEXISTENTE";

export class ErrorUmbral extends Error {
  override readonly name = "ErrorUmbral";
  constructor(readonly codigo: CodigoErrorUmbral) {
    super(codigo);
  }
}
