import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { inicioDiaBogota } from "@/lib/bogota";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const u = await verifyAuth([1, 2, 3]);
    const nit =
      u.rolId === 3 && u.administradorId != null
        ? String(u.administradorId)
        : String(u.identificacion ?? "");
    const where = u.rolId === 1 ? {} : { nitVigilado: nit.slice(0, 20) };

    const [despachosHoy, enCola, procesados, fallidos] = await Promise.all([
      // Bug 5 corregido: cuenta SOLO los de hoy (America/Bogota), no el histórico.
      prisma.despachoSolicitud.count({
        where: { ...where, fechaCreacion: { gte: inicioDiaBogota() } },
      }),
      prisma.despachoSolicitud.count({ where: { ...where, estado: "pendiente" } }),
      prisma.despachoSolicitud.count({ where: { ...where, estado: "procesado" } }),
      prisma.despachoSolicitud.count({ where: { ...where, estado: "fallido" } }),
    ]);

    const total = procesados + fallidos;
    const nivelExito = total > 0 ? Math.round((procesados / total) * 100) : 100;

    return NextResponse.json({ kpis: { despachosHoy, enCola, procesados, fallidos, nivelExito } });
  } catch (err: unknown) {
    if (err instanceof AppError) return NextResponse.json(err.toJSON(), { status: err.statusCode });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
