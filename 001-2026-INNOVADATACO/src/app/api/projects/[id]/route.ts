import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, esCodigoPrisma, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { esFasePm2 } from "@/lib/fasesPm2";
import { prisma } from "@/lib/prisma";

/**
 * Edición y borrado de un proyecto (spec 008, US1).
 *
 * Hasta esta spec el módulo solo tenía `GET`/`POST` en `/api/projects`: un
 * proyecto creado no se podía corregir. Estas dos rutas cierran ese gap y son
 * además el mecanismo que usa el tablero de fases para persistir un movimiento
 * (US2), igual que SPEC-007 reutiliza el PATCH de oportunidades.
 */

// PATCH /api/projects/[id] — editar un proyecto
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;
    const data = await req.json();

    const existente = await prisma.proyecto.findUnique({ where: { id } });
    if (!existente) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Las fases son fijas (metodología PM2), no un catálogo abierto: una fase
    // inventada es input inválido, no un dato a persistir (§5.2).
    if (data.currentPhase !== undefined && !esFasePm2(data.currentPhase)) {
      return NextResponse.json(
        { error: "La fase indicada no es una fase PM2 válida" },
        { status: 400 },
      );
    }

    const updateData: Prisma.ProyectoUncheckedUpdateInput = {};
    if (data.codigo !== undefined) {
      if (!data.codigo) {
        return NextResponse.json({ error: "El código no puede quedar vacío" }, { status: 400 });
      }
      updateData.codigo = data.codigo;
    }
    if (data.nombre !== undefined) {
      if (!data.nombre) {
        return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 });
      }
      updateData.nombre = data.nombre;
    }
    if (data.cliente !== undefined) updateData.cliente = data.cliente;
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.currentPhase !== undefined) updateData.currentPhase = data.currentPhase;

    const proyecto = await prisma.proyecto.update({ where: { id }, data: updateData });

    // Auditoría (§2.5). El cambio de fase deja su propio registro con origen y
    // destino (FR-006); reenviar la misma fase no es un movimiento y no se
    // registra como tal (FR-007, también en el servidor).
    const cambioDeFase =
      data.currentPhase !== undefined && data.currentPhase !== existente.currentPhase;

    if (cambioDeFase) {
      await auditLog({
        action: "proyecto.fase.cambio",
        entityType: "Proyecto",
        entityId: id,
        userId: session.sub,
        status: "success",
        message: `Fase ${existente.currentPhase} → ${data.currentPhase}`,
        metadata: { faseAnterior: existente.currentPhase, faseNueva: data.currentPhase },
      });
    }

    const otrosCampos = Object.keys(updateData).filter((campo) => campo !== "currentPhase");
    if (otrosCampos.length > 0) {
      await auditLog({
        action: "proyecto.editado",
        entityType: "Proyecto",
        entityId: id,
        userId: session.sub,
        status: "success",
        message: `Proyecto ${existente.codigo} editado`,
        metadata: { campos: otrosCampos },
      });
    }

    return NextResponse.json(proyecto);
  } catch (err: unknown) {
    if (esCodigoPrisma(err, "P2002")) {
      return apiError("Proyectos", "PATCH proyecto", "Ya existe un proyecto con ese código", 409, err);
    }
    return apiError("Proyectos", "PATCH proyecto", "Error actualizando proyecto", 500, err);
  }
}

// DELETE /api/projects/[id] — eliminar un proyecto
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const existente = await prisma.proyecto.findUnique({ where: { id } });
    if (!existente) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Hoy el proyecto no tiene tablas hijas. Cuando US3–US6 añadan entregables,
    // partidas, recursos y lecciones, la FK las borrará en CASCADE (FR-002) y
    // este manejador no cambia.
    await prisma.proyecto.delete({ where: { id } });

    await auditLog({
      action: "proyecto.eliminado",
      entityType: "Proyecto",
      entityId: id,
      userId: session.sub,
      status: "success",
      message: `Proyecto ${existente.codigo} eliminado`,
    });

    return NextResponse.json({ success: true, message: "Proyecto eliminado" });
  } catch (err: unknown) {
    return apiError("Proyectos", "DELETE proyecto", "Error eliminando proyecto", 500, err);
  }
}
