import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { cliente: true, responsable: true, oportunidad: true, hitos: true, documentos: true },
  });

  if (!proyecto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(proyecto);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: {
      nombre: body.nombre,
      clienteId: body.clienteId,
      responsableId: body.responsableId,
      fechaInicioReal: body.fechaInicioReal ? new Date(body.fechaInicioReal) : undefined,
      fechaEntregaPlaneada: body.fechaEntregaPlaneada ? new Date(body.fechaEntregaPlaneada) : undefined,
      fechaEntregaReal: body.fechaEntregaReal ? new Date(body.fechaEntregaReal) : undefined,
      valorContratado: body.valorContratado !== undefined ? Number(body.valorContratado) : undefined,
      alcance: body.alcance,
      estado: body.estado,
      progreso: body.progreso,
    },
    include: { cliente: true, responsable: true, hitos: true },
  });

  return NextResponse.json(proyecto);
}
