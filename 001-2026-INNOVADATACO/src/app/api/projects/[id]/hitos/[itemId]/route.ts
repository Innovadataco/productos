import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarHito, datosHito } from "@/lib/proyectoPm2";
import { prisma } from "@/lib/prisma";

/**
 * Edición y borrado de un elemento concreto (spec 008).
 *
 * Se comprueba SIEMPRE que pertenezca al proyecto de la ruta: sin eso,
 * `/api/projects/<otro>/hitos/<id>` dejaría tocar lo de un proyecto ajeno
 * entrando por la puerta de otro.
 */
async function delProyecto(proyectoId: string, itemId: string) {
  const item = await prisma.hitoProyecto.findUnique({ where: { id: itemId } });
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
      return NextResponse.json({ error: "Hito no encontrado" }, { status: 404 });
    }

    // Se valida el RESULTADO de aplicar el cambio, no solo lo que llega: un
    // PATCH parcial no puede dejar el registro en un estado inválido.
    const resultante = { ...existente, ...body };
    const problema = validarHito(resultante);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const actualizado = await prisma.hitoProyecto.update({
      where: { id: itemId },
      data: datosHito(resultante as Record<string, unknown>),
    });

    await auditLog({
      action: "proyecto.hito.editado",
      entityType: "Hito",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Hito actualizado`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    return apiError("Proyectos", "PATCH hito", "Error actualizando hito", 500, err);
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
      return NextResponse.json({ error: "Hito no encontrado" }, { status: 404 });
    }

    await prisma.hitoProyecto.delete({ where: { id: itemId } });

    await auditLog({
      action: "proyecto.hito.eliminado",
      entityType: "Hito",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Hito eliminado`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return apiError("Proyectos", "DELETE hito", "Error eliminando hito", 500, err);
  }
}
