/**
 * Qué muestra /decisiones (el diario), según el `?regla=` pedido. Solo lectura.
 * La regla del query se acepta solo si tiene la forma de un id y existe en la base: se filtra por la que vino de la
 * base (el texto del query no se repite en la pantalla). Si no, se avisa y se muestran todas.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { leerDiario, reglaPorId } from "@/plan/lectura";
import { fechaEnBogota } from "@/precios/horario";
import { idDeConsulta } from "../_plan/consulta";
import { aVistaDiario } from "../_plan/serializar";
import type { VistaDiario } from "../_plan/tipos";

export async function datosDelDiario(db: PrismaClient, pedido: string | string[] | undefined): Promise<VistaDiario> {
  const hoy = fechaEnBogota(new Date());
  const id = idDeConsulta(pedido);
  const regla = id === null ? null : await reglaPorId(db, id);
  const lectura = await leerDiario(db, hoy, regla?.id ?? null);
  return aVistaDiario(lectura, regla ? { especie: regla.nemotecnico, version: regla.version } : null, pedido !== undefined && regla === null);
}
