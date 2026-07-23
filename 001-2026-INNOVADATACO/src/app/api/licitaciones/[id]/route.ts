import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/[id] - Obtener una licitación específica
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const licitacion = await prisma.licitacion.findUnique({
      where: { id },
      include: {
        estado: true,
        entidad: true,
        documentos: {
          include: {
            entidad: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!licitacion) {
      return NextResponse.json(
        { error: "Licitación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(licitacion);
  } catch (error: unknown) {
    return apiError("Licitaciones", "GET detalle", "Error al obtener licitación", 500, error);
  }
}

// PATCH /api/licitaciones/[id] - Actualizar una licitación
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();

    const licitacionExistente = await prisma.licitacion.findUnique({
      where: { id },
    });

    if (!licitacionExistente) {
      return NextResponse.json(
        { error: "Licitación no encontrada" },
        { status: 404 }
      );
    }

    // Unchecked: la ruta asigna las claves foráneas escalares (estadoId, entidadId,
    // areaIdSala) en vez de conectar relaciones anidadas.
    const updateData: Prisma.LicitacionUncheckedUpdateInput = {};
    
    if (data.numero !== undefined) updateData.numero = data.numero;
    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.estadoId !== undefined) updateData.estadoId = parseInt(data.estadoId);
    if (data.entidadId !== undefined) updateData.entidadId = data.entidadId ? parseInt(data.entidadId) : null;
    if (data.areaIdSala !== undefined) updateData.areaIdSala = data.areaIdSala ? parseInt(data.areaIdSala) : null;
    if (data.fechaApertura !== undefined) updateData.fechaApertura = new Date(data.fechaApertura);
    if (data.documentoUrl !== undefined) updateData.documentoUrl = data.documentoUrl;
    if (data.contenido !== undefined) updateData.contenido = data.contenido;

    const licitacion = await prisma.licitacion.update({
      where: { id },
      data: updateData,
      include: {
        estado: true,
        entidad: true,
      },
    });

    return NextResponse.json(licitacion);
  } catch (error: unknown) {
    return apiError("Licitaciones", "PATCH detalle", "Error al actualizar licitación", 500, error);
  }
}

// DELETE /api/licitaciones/[id] - Eliminar una licitación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const licitacionExistente = await prisma.licitacion.findUnique({
      where: { id },
    });

    if (!licitacionExistente) {
      return NextResponse.json(
        { error: "Licitación no encontrada" },
        { status: 404 }
      );
    }

    await prisma.licitacion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Licitación eliminada" });
  } catch (error: unknown) {
    return apiError("Licitaciones", "DELETE detalle", "Error al eliminar licitación", 500, error);
  }
}
