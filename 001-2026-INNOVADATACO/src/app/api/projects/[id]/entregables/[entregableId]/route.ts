import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { datosEntregable, validarEntregable } from "@/lib/entregable";
import { prisma } from "@/lib/prisma";

/**
 * Edición y borrado de un entregable concreto (spec 008, US3 / FR-009).
 *
 * Se comprueba SIEMPRE que el entregable pertenezca al proyecto de la ruta: sin
 * eso, `/api/projects/<otro>/entregables/<id>` permitiría editar el entregable
 * de un proyecto ajeno pasando por la puerta de otro.
 */

async function entregableDelProyecto(proyectoId: string, entregableId: string) {
  const entregable = await prisma.entregable.findUnique({ where: { id: entregableId } });
  if (!entregable || entregable.proyectoId !== proyectoId) return null;
  return entregable;
}

// PATCH /api/projects/[id]/entregables/[entregableId] — editar
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entregableId: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id, entregableId } = await params;
    const body = await req.json();

    const existente = await entregableDelProyecto(id, entregableId);
    if (!existente) {
      return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });
    }

    // Se valida el resultado de aplicar el cambio, no solo lo que llega: así un
    // PATCH parcial no puede dejar el entregable en un estado inválido.
    const resultante = { ...existente, ...body };
    const problema = validarEntregable(resultante);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const entregable = await prisma.entregable.update({
      where: { id: entregableId },
      data: datosEntregable(resultante as Record<string, unknown>),
    });

    await auditLog({
      action: "proyecto.entregable.editado",
      entityType: "Entregable",
      entityId: entregableId,
      userId: session.sub,
      status: "success",
      message: `Entregable "${entregable.nombre}" actualizado`,
      metadata: { proyectoId: id, avance: entregable.avance, estado: entregable.estado },
    });

    return NextResponse.json(entregable);
  } catch (err: unknown) {
    return apiError("Proyectos", "PATCH entregable", "Error actualizando entregable", 500, err);
  }
}

// DELETE /api/projects/[id]/entregables/[entregableId] — eliminar
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entregableId: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id, entregableId } = await params;

    const existente = await entregableDelProyecto(id, entregableId);
    if (!existente) {
      return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });
    }

    await prisma.entregable.delete({ where: { id: entregableId } });

    await auditLog({
      action: "proyecto.entregable.eliminado",
      entityType: "Entregable",
      entityId: entregableId,
      userId: session.sub,
      status: "success",
      message: `Entregable "${existente.nombre}" eliminado`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json({ success: true, message: "Entregable eliminado" });
  } catch (err: unknown) {
    return apiError("Proyectos", "DELETE entregable", "Error eliminando entregable", 500, err);
  }
}
