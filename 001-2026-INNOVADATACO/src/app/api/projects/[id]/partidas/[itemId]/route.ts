import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarPartidaProyecto, datosPartida } from "@/lib/proyectoPm2";
import { prisma } from "@/lib/prisma";

/**
 * Edición y borrado de un elemento concreto (spec 008).
 *
 * Se comprueba SIEMPRE que pertenezca al proyecto de la ruta: sin eso,
 * `/api/projects/<otro>/partidas/<id>` dejaría tocar lo de un proyecto ajeno
 * entrando por la puerta de otro.
 */
async function delProyecto(proyectoId: string, itemId: string) {
  const item = await prisma.partidaProyecto.findUnique({ where: { id: itemId } });
  if (!item || item.proyectoId !== proyectoId) return null;
  return item;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id, itemId } = await params;
    const body = await req.json();

    const existente = await delProyecto(id, itemId);
    if (!existente) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    // Se valida el RESULTADO de aplicar el cambio, no solo lo que llega: un
    // PATCH parcial no puede dejar el registro en un estado inválido.
    const resultante = { ...existente, ...body };
    const problema = validarPartidaProyecto(resultante);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const actualizado = await prisma.partidaProyecto.update({
      where: { id: itemId },
      data: datosPartida(resultante as Record<string, unknown>),
    });

    await auditLog({
      action: "proyecto.partida.editado",
      entityType: "PartidaProyecto",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Partida actualizada`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    return apiError("Proyectos", "PATCH partida", "Error actualizando la partida", 500, err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id, itemId } = await params;

    const existente = await delProyecto(id, itemId);
    if (!existente) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    await prisma.partidaProyecto.delete({ where: { id: itemId } });

    await auditLog({
      action: "proyecto.partida.eliminado",
      entityType: "PartidaProyecto",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Partida eliminada`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return apiError("Proyectos", "DELETE partida", "Error eliminando la partida", 500, err);
  }
}
