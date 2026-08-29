import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarRiesgo, datosRiesgo } from "@/lib/riesgo";
import { prisma } from "@/lib/prisma";

/**
 * Edición y borrado de un elemento concreto (spec 008).
 *
 * Se comprueba SIEMPRE que pertenezca al proyecto de la ruta: sin eso,
 * `/api/projects/<otro>/riesgos/<id>` dejaría tocar lo de un proyecto ajeno
 * entrando por la puerta de otro.
 */
async function delProyecto(proyectoId: string, itemId: string) {
  const item = await prisma.riesgoProyecto.findUnique({ where: { id: itemId } });
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
      return NextResponse.json({ error: "Riesgo no encontrado" }, { status: 404 });
    }

    // Se valida el RESULTADO de aplicar el cambio, no solo lo que llega: un
    // PATCH parcial no puede dejar el registro en un estado inválido.
    const resultante = { ...existente, ...body };
    const problema = validarRiesgo(resultante);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const actualizado = await prisma.riesgoProyecto.update({
      where: { id: itemId },
      data: datosRiesgo(resultante as Record<string, unknown>),
    });

    await auditLog({
      action: "proyecto.riesgo.editado",
      entityType: "RiesgoProyecto",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Riesgo actualizado`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(actualizado);
  } catch (err: unknown) {
    return apiError("Proyectos", "PATCH riesgo", "Error actualizando riesgo", 500, err);
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
      return NextResponse.json({ error: "Riesgo no encontrado" }, { status: 404 });
    }

    await prisma.riesgoProyecto.delete({ where: { id: itemId } });

    await auditLog({
      action: "proyecto.riesgo.eliminado",
      entityType: "RiesgoProyecto",
      entityId: itemId,
      userId: session.sub,
      status: "success",
      message: `Riesgo eliminado`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return apiError("Proyectos", "DELETE riesgo", "Error eliminando riesgo", 500, err);
  }
}
