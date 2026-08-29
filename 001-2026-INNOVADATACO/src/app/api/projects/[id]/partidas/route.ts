import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarPartidaProyecto, datosPartida, resumirPresupuesto } from "@/lib/proyectoPm2";
import { prisma } from "@/lib/prisma";

/**
 * Presupuesto del proyecto con control de gasto PM2 (spec 008, US5 / FR-012).
 *
 * A diferencia de las demás colecciones, el `GET` devuelve además el **resumen**
 * —total planeado, total ejecutado y desviación—, calculado al leer, como el
 * total de presupuesto de Oportunidades (FR-008 de la spec 006). El cliente no
 * tiene que sumar nada, así que no puede sumar distinto.
 */

// GET /api/projects/[id]/partidas
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const partidas = await prisma.partidaProyecto.findMany({
      where: { proyectoId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ partidas, resumen: resumirPresupuesto(partidas) });
  } catch (err: unknown) {
    return apiError("Proyectos", "GET partidas", "Error listando el presupuesto", 500, err);
  }
}

// POST /api/projects/[id]/partidas
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;
    const body = await req.json();

    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const problema = validarPartidaProyecto(body);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const partida = await prisma.partidaProyecto.create({
      data: { ...datosPartida(body), proyectoId: id },
    });

    await auditLog({
      action: "proyecto.partida.creada",
      entityType: "PartidaProyecto",
      entityId: partida.id,
      userId: session.sub,
      status: "success",
      message: `Partida "${partida.concepto}" en ${proyecto.codigo}`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(partida, { status: 201 });
  } catch (err: unknown) {
    return apiError("Proyectos", "POST partida", "Error creando la partida", 500, err);
  }
}
