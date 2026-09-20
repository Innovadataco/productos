import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id },
    include: { cliente: true },
  });

  if (!oportunidad) {
    return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
  }

  if (oportunidad.estado !== "ADJUDICADA" && oportunidad.estado !== "PRESENTADA") {
    return NextResponse.json(
      { error: "Solo se pueden convertir oportunidades adjudicadas o presentadas" },
      { status: 400 }
    );
  }

  const count = await prisma.proyecto.count();
  const codigo = `IDC-2026-${String(count + 1).padStart(3, "0")}`;

  const proyecto = await prisma.proyecto.create({
    data: {
      codigo,
      nombre: oportunidad.nombre,
      oportunidadId: oportunidad.id,
      clienteId: oportunidad.clienteId || body.clienteId,
      responsableId: body.responsableId || oportunidad.responsableId,
      fechaInicioReal: body.fechaInicioReal ? new Date(body.fechaInicioReal) : new Date(),
      fechaEntregaPlaneada: oportunidad.fechaFinPlaneada,
      valorContratado: oportunidad.valorEstimado,
      alcance: oportunidad.alcance,
      estado: "PLANIFICACION",
    },
  });

  await prisma.oportunidad.update({
    where: { id },
    data: { estado: "ADJUDICADA" },
  });

  return NextResponse.json(proyecto, { status: 201 });
}
