import "server-only";
/**
 * Punto de entrada del servidor para la pantalla de proyecciones: valida los parámetros ANTES de tocar la base, lee
 * las entradas y simula. Lo que mueve el usuario no se guarda. Dos topes: MAX_TRABAJO (trayectorias × meses, en la
 * validación) y MAX_PASOS (× ruedas × posiciones, al simular; sale como DEMASIADO_TRABAJO).
 * Contrato para la ruta o la acción que lo llame (frente de la pantalla; security-reviewer M2, B1 y B3):
 * - exigir la sesión antes de llamarlo: el resultado trae el valor, los pesos y los nombres del portafolio;
 * - el cálculo es síncrono (hasta ≈ 1 s): una proyección en vuelo por usuario y un límite de frecuencia, con debounce
 *   en el cliente; cuerpo JSON chico; `Cache-Control: no-store`;
 * - no pasar `hoy` desde el cliente (existe para las pruebas);
 * - ante un error, mensaje genérico al usuario y el detalle solo al registro del servidor, sin datos del portafolio.
 */
import type { PrismaClient } from "@prisma/client";
import { fechaEnBogota } from "../precios/horario";
import { calcularProyeccion } from "./calcular";
import { leerEntradas } from "./leer";
import { validarParametros } from "./parametros";
import { ErrorTrabajo } from "./simulacion";
import type { Proyeccion } from "./tipos";

export async function proyectar(db: PrismaClient, entrada: unknown, hoy: Date = fechaEnBogota(new Date())): Promise<Proyeccion> {
  const v = validarParametros(entrada);
  if (!v.ok) return { ok: false, errores: v.errores };
  const entradas = await leerEntradas(db, hoy);
  try {
    return { ok: true, resultado: calcularProyeccion(entradas, v.valor) };
  } catch (error) {
    if (error instanceof ErrorTrabajo) return { ok: false, errores: [{ campo: "trayectorias", codigo: "DEMASIADO_TRABAJO" }] };
    throw error;
  }
}
