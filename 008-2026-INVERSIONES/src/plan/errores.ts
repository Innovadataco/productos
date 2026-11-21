/** Errores del plan: solo códigos y nombres de campo, nunca valores (son datos reales del dueño). */
import { Prisma } from "@prisma/client";

export interface ErrorCampo {
  readonly campo: string;
  readonly codigo: string;
}

export class ErrorPlan extends Error {
  constructor(
    readonly codigo: string,
    readonly errores: readonly ErrorCampo[] = [],
  ) {
    super(codigo);
    this.name = "ErrorPlan";
  }
}

/** Lanza DATOS_INVALIDOS con la lista, si la hay. */
export function exigirSinErrores(errores: readonly ErrorCampo[]): void {
  if (errores.length > 0) throw new ErrorPlan("DATOS_INVALIDOS", errores);
}

/** Traduce un choque de unicidad (P2002) a un código del plan; lo demás sigue igual. */
export function traducirChoque(error: unknown, codigos: Readonly<Record<string, string>>): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return error;
  const objetivo = JSON.stringify(error.meta?.["target"] ?? "");
  const codigo = Object.entries(codigos).find(([patron]) => objetivo.includes(patron))?.[1];
  return codigo ? new ErrorPlan(codigo) : error;
}
