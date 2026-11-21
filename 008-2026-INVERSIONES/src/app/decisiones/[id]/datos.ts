/**
 * Qué muestra /decisiones/[id]: la cadena completa de una decisión. Solo lectura. Un id que no tiene la forma de los
 * de la base no llega a la base; uno que no existe da el mismo aviso. El id no se repite en la pantalla.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { leerDecision } from "@/plan/lectura";
import { fechaEnBogota } from "@/precios/horario";
import { idDeConsulta } from "../../_plan/consulta";
import { aVistaDecision } from "../../_plan/serializar";
import type { DatosDecision } from "../../_plan/tipos";

export async function datosDeDecision(db: PrismaClient, pedido: string): Promise<DatosDecision> {
  const id = idDeConsulta(pedido);
  if (id === null) return { estado: "NO_EXISTE" };
  const lectura = await leerDecision(db, id, fechaEnBogota(new Date()));
  return lectura ? { estado: "DECISION", vista: aVistaDecision(lectura) } : { estado: "NO_EXISTE" };
}
