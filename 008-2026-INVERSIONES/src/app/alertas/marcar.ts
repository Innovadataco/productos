import "server-only";
/**
 * Marcar alertas como vistas (la escribe el dueño desde /alertas, como inv_app: INSERT por columna en alerta_vista, sin la hora,
 * que pone la base). Idempotente: una marca por alerta (índice único) y `skipDuplicates`, así marcar lo ya marcado escribe cero.
 * El disparador de la base exige que el usuario sea el dueño (rol DUENO): aunque la ruta fallara, la familia no marca. Es el
 * ÚNICO módulo que escribe alerta_vista; las lecturas (datos.ts) no lo importan.
 */
import type { PrismaClient } from "@prisma/client";
import { sumarDias } from "@/plan/fechas";
import { VENTANA_ALERTAS_DIAS } from "./parametros";

type Escritor = Pick<PrismaClient, "alerta" | "alertaVista">;

/** Marca una alerta; `existe` falso si no hay tal alerta (nada se escribe). */
export async function marcarVista(db: Escritor, alertaId: string, usuarioId: string): Promise<{ readonly existe: boolean; readonly marcadas: number }> {
  const alerta = await db.alerta.findUnique({ where: { id: alertaId }, select: { id: true } });
  if (alerta === null) return { existe: false, marcadas: 0 };
  const { count } = await db.alertaVista.createMany({ data: [{ alertaId, usuarioId }], skipDuplicates: true });
  return { existe: true, marcadas: count };
}

/** Marca todas las de la ventana de 30 días (hasta `hoy`) que faltan. */
export async function marcarTodas(db: Escritor, usuarioId: string, hoy: Date): Promise<{ readonly marcadas: number }> {
  const pendientes = await db.alerta.findMany({
    where: { dia: { gte: sumarDias(hoy, -(VENTANA_ALERTAS_DIAS - 1)), lte: hoy }, vista: { is: null } },
    select: { id: true },
  });
  if (pendientes.length === 0) return { marcadas: 0 };
  const { count } = await db.alertaVista.createMany({ data: pendientes.map((a) => ({ alertaId: a.id, usuarioId })), skipDuplicates: true });
  return { marcadas: count };
}
