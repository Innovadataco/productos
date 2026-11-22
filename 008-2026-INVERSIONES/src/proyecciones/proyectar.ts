import "server-only";
/**
 * Punto de entrada del servidor para la pantalla de proyecciones: valida los parámetros ANTES de tocar la base, lee
 * las entradas y simula. Lo que mueve el usuario no se guarda. El cálculo es síncrono (≈ 1 s en el peor caso
 * permitido por MAX_TRABAJO): quien lo llame desde una ruta debe limitar la frecuencia por usuario.
 */
import type { PrismaClient } from "@prisma/client";
import { fechaEnBogota } from "../precios/horario";
import { calcularProyeccion } from "./calcular";
import { leerEntradas } from "./leer";
import { validarParametros } from "./parametros";
import type { Proyeccion } from "./tipos";

export async function proyectar(db: PrismaClient, entrada: unknown, hoy: Date = fechaEnBogota(new Date())): Promise<Proyeccion> {
  const v = validarParametros(entrada);
  if (!v.ok) return { ok: false, errores: v.errores };
  return { ok: true, resultado: calcularProyeccion(await leerEntradas(db, hoy), v.valor) };
}
