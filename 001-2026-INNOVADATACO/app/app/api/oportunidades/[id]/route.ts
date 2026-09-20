import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id },
    include: { cliente: true, responsable: true, proyecto: true, documentos: true },
  });

  if (!oportunidad) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json(oportunidad);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const oportunidad = await prisma.oportunidad.update({
    where: { id },
    data: {
      nombre: body.nombre,
      modalidad: body.modalidad,
      entidadContratante: body.entidadContratante,
      clienteId: body.clienteId,
      responsableId: body.responsableId,
      fechaInicioPlaneada: body.fechaInicioPlaneada ? new Date(body.fechaInicioPlaneada) : undefined,
      fechaFinPlaneada: body.fechaFinPlaneada ? new Date(body.fechaFinPlaneada) : undefined,
      valorEstimado: body.valorEstimado !== undefined ? Number(body.valorEstimado) : undefined,
      alcance: body.alcance,
      estado: body.estado,
    },
    include: { cliente: true, responsable: true },
  });

  return NextResponse.json(oportunidad);
}
