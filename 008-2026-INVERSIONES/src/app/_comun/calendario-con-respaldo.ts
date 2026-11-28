import "server-only";
/**
 * El calendario de la BVC para las pantallas que avisan el dato viejo (frente fuente-retraso: tablero y /analisis). Si no
 * se puede leer, la pantalla se pinta igual y el aviso no se apaga: se usa CALENDARIO_DE_RESPALDO (sin festivos ni años
 * cubiertos, así que el aviso sale aproximado). Se registra solo el nombre del error (su mensaje puede traer la URL).
 */
import type { PrismaClient } from "@prisma/client";
import { calendarioBvc } from "@/plan/lectura";
import { CALENDARIO_DE_RESPALDO } from "@/precios/atraso";
import type { CalendarioBvc } from "@/precios/negociacion";

export async function calendarioConRespaldo(db: PrismaClient, pantalla: string): Promise<CalendarioBvc> {
  try {
    return await calendarioBvc(db);
  } catch (error) {
    console.error(`[${pantalla}] no se pudo leer el calendario de la BVC (${error instanceof Error ? error.name : "desconocido"})`);
    return CALENDARIO_DE_RESPALDO;
  }
}
