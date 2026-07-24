import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/[id] - Obtener una licitación específica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const oportunidad = await prisma.licitacion.findUnique({
      where: { id },
      include: {
        estado: true,
        entidad: true,
        tipo: true,
        partidas: true,
        documentos: {
          include: { entidad: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!oportunidad) {
      return NextResponse.json(
        { error: "Oportunidad no encontrada" },
        { status: 404 }
      );
    }

    // Total del presupuesto calculado al leer (FR-008).
    const totalPresupuesto = oportunidad.partidas.reduce((acc, p) => acc + Number(p.monto), 0);

    return NextResponse.json({ ...oportunidad, totalPresupuesto });
  } catch (error: unknown) {
    return apiError("Oportunidades", "GET detalle", "Error al obtener oportunidad", 500, error);
  }
}

// PATCH /api/licitaciones/[id] - Actualizar una licitación
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;
    const data = await req.json();

    const existente = await prisma.licitacion.findUnique({ where: { id } });

    if (!existente) {
      return NextResponse.json(
        { error: "Oportunidad no encontrada" },
        { status: 404 }
      );
    }

    // Unchecked: la ruta asigna las claves foráneas escalares (estadoId, entidadId,
    // tipoId, areaIdSala) en vez de conectar relaciones anidadas.
    const updateData: Prisma.LicitacionUncheckedUpdateInput = {};

    if (data.numero !== undefined) updateData.numero = data.numero || null;
    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.estadoId !== undefined) updateData.estadoId = parseInt(data.estadoId);
    if (data.tipoId !== undefined) updateData.tipoId = data.tipoId ? parseInt(data.tipoId) : null;
    if (data.entidadId !== undefined) updateData.entidadId = data.entidadId ? parseInt(data.entidadId) : null;
    if (data.areaIdSala !== undefined) updateData.areaIdSala = data.areaIdSala ? parseInt(data.areaIdSala) : null;
    if (data.fechaApertura !== undefined) updateData.fechaApertura = data.fechaApertura ? new Date(data.fechaApertura) : null;
    if (data.fechaPliegosDefinitivos !== undefined) updateData.fechaPliegosDefinitivos = data.fechaPliegosDefinitivos ? new Date(data.fechaPliegosDefinitivos) : null;
    if (data.fechaEntregaPropuesta !== undefined) updateData.fechaEntregaPropuesta = data.fechaEntregaPropuesta ? new Date(data.fechaEntregaPropuesta) : null;
    if (data.fechaAdjudicacion !== undefined) updateData.fechaAdjudicacion = data.fechaAdjudicacion ? new Date(data.fechaAdjudicacion) : null;
    if (data.fechaCierre !== undefined) updateData.fechaCierre = data.fechaCierre ? new Date(data.fechaCierre) : null;
    if (data.ciudadEjecucion !== undefined) updateData.ciudadEjecucion = data.ciudadEjecucion || null;
    if (data.documentoUrl !== undefined) updateData.documentoUrl = data.documentoUrl;
    if (data.contenido !== undefined) updateData.contenido = data.contenido;

    const oportunidad = await prisma.licitacion.update({
      where: { id },
      data: updateData,
      include: { estado: true, entidad: true, tipo: true, partidas: true },
    });

    return NextResponse.json(oportunidad);
  } catch (error: unknown) {
    return apiError("Oportunidades", "PATCH detalle", "Error al actualizar oportunidad", 500, error);
  }
}

// DELETE /api/licitaciones/[id] - Eliminar una licitación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const existente = await prisma.licitacion.findUnique({ where: { id } });

    if (!existente) {
      return NextResponse.json(
        { error: "Oportunidad no encontrada" },
        { status: 404 }
      );
    }

    // CASCADE borra las partidas y los documentos del expediente asociados.
    await prisma.licitacion.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Oportunidad eliminada" });
  } catch (error: unknown) {
    return apiError("Oportunidades", "DELETE detalle", "Error al eliminar oportunidad", 500, error);
  }
}
