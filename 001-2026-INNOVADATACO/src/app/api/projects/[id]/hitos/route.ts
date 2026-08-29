import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { validarHito, datosHito } from "@/lib/proyectoPm2";
import { prisma } from "@/lib/prisma";

/**
 * Cronograma del proyecto (spec 008, US4 / FR-011).\n *\n * Se ordena por fecha en el servidor: el cronograma sin orden no es cronograma\n * (FR-011 lo exige explícitamente).
 *
 * Cuelga de la ruta del proyecto, igual que los entregables: el recurso no
 * existe sin su padre y la ruta lo dice.
 */

// GET /api/projects/[id]/hitos
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

    const items = await prisma.hitoProyecto.findMany({
      where: { proyectoId: id },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(items);
  } catch (err: unknown) {
    return apiError("Proyectos", "GET hitos", "Error listando hitos del proyecto", 500, err);
  }
}

// POST /api/projects/[id]/hitos
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

    const problema = validarHito(body);
    if (problema) return NextResponse.json({ error: problema }, { status: 400 });

    const creado = await prisma.hitoProyecto.create({
      data: { ...datosHito(body), proyectoId: id },
    });

    await auditLog({
      action: "proyecto.hito.creado",
      entityType: "Hito",
      entityId: creado.id,
      userId: session.sub,
      status: "success",
      message: `Hito en ${proyecto.codigo}`,
      metadata: { proyectoId: id },
    });

    return NextResponse.json(creado, { status: 201 });
  } catch (err: unknown) {
    return apiError("Proyectos", "POST hito", "Error creando hito", 500, err);
  }
}
