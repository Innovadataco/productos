import "server-only";
/**
 * El cálculo de la pantalla de proyecciones en el servidor (frente proyecciones-pantalla): proyecta con el motor
 * (src/proyecciones/proyectar.ts, que valida antes de tocar la base y toma `hoy` de la fecha de Colombia: nunca del
 * cliente) y arma la vista mínima. La usan la página (cálculo inicial) y POST /api/proyecciones, siempre dentro del
 * turno (src/app/proyecciones/turno.ts) y después de exigir la sesión.
 */
import type { PrismaClient } from "@prisma/client";
import { proyectar } from "@/proyecciones/proyectar";
import type { ErrorParametro, ParametrosProyeccion } from "@/proyecciones/tipos";
import { aVistaProyeccion, type VistaProyeccion } from "./vista";

export type Calculo = { readonly ok: true; readonly vista: VistaProyeccion } | { readonly ok: false; readonly errores: readonly ErrorParametro[] };

export async function calcularVista(db: PrismaClient, parametros: ParametrosProyeccion): Promise<Calculo> {
  const r = await proyectar(db, parametros);
  return r.ok ? { ok: true, vista: aVistaProyeccion(r.resultado) } : { ok: false, errores: r.errores };
}

/** El nombre del error, nunca su mensaje (podría traer cifras o nombres del portafolio). */
export const nombreDelError = (error: unknown): string => (error instanceof Error ? error.name : "desconocido");
