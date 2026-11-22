import "server-only";
/**
 * Lectura de las series oficiales (fase C, C5a). ESQUEMA DEL ROJO: solo tipos y firmas; la implementación llega en el
 * commit verde.
 */
import type { Prisma } from "@prisma/client";
import { CATALOGO, type SerieCatalogo } from "../catalogo";
import type { CifraOficial } from "./consulta";

export type LectorSeries = Prisma.TransactionClient;

export const MAX_DIAS_TRAS_DESDE_LECTURA = 31;
export const MAX_DIAS_RANGO_SERIES = 40 * 366;

export async function ultimoValor(db: LectorSeries, codigo: string, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<CifraOficial | null> {
  void db;
  void codigo;
  void hoy;
  void catalogo;
  throw new Error("NO_IMPLEMENTADO");
}

export async function valorVigenteEn(db: LectorSeries, codigo: string, fecha: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<CifraOficial | null> {
  void db;
  void codigo;
  void fecha;
  void catalogo;
  throw new Error("NO_IMPLEMENTADO");
}

export async function serieEnRango(db: LectorSeries, codigo: string, desde: Date, hasta: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): Promise<readonly CifraOficial[]> {
  void db;
  void codigo;
  void desde;
  void hasta;
  void catalogo;
  throw new Error("NO_IMPLEMENTADO");
}
