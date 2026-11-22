import "server-only";
/** Lector de los decretos (fase C, C5b). Stub del rojo: las firmas; lanza PENDIENTE. */
import type { PrismaClient } from "@prisma/client";
import type { ResultadoCruce } from "./cruce";
import type { Proximo } from "./proximos";

const pendiente = (): never => {
  throw new Error("PENDIENTE");
};
export const coberturaTrii = async (_db: PrismaClient): Promise<Date | null> => pendiente();
export const leerCruce = async (_db: PrismaClient, _hoy: Date, _desde: Date): Promise<ResultadoCruce> => pendiente();
export const leerProximos = async (_db: PrismaClient, _hoy: Date): Promise<readonly Proximo[]> => pendiente();
