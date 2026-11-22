// Esqueleto del rojo: las firmas, sin implementar.
import type { Prisma } from "@prisma/client";
import type { Afectacion, AvisoSimulacion, ComisionEstimada, ErrorSimulacion, LadoSimulado, ReglaSimulada } from "./tipos";

export const ETIQUETA_COMISION = "";
export const COMISION_SIN_HISTORIA = "";
export const NOTA_CAJA_SIN_COMISION = "";
export const NOTA_VALORACION = "";

const sinImplementar = (): never => {
  throw new Error("sin implementar");
};

export const textoPesos = (_d: Prisma.Decimal): string => sinImplementar();
export const textoComision = (_c: ComisionEstimada, _lado: LadoSimulado): string => sinImplementar();
export const textoError = (_e: ErrorSimulacion): string => sinImplementar();
export const textoAviso = (_a: AvisoSimulacion): string => sinImplementar();
export const textoAfectacion = (_a: Afectacion): string => sinImplementar();
export const textoRegla = (_r: ReglaSimulada, _nemotecnico: string): string => sinImplementar();
