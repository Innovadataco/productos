import { NextRequest, NextResponse } from "next/server";
import { apiError, noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/entidades - Listar todas las entidades
export async function GET() {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const entidades = await prisma.entidadLicitacion.findMany({
      orderBy: { nombreOficial: "asc" },
    });

    return NextResponse.json(entidades);
  } catch (error: unknown) {
    return apiError("Licitaciones", "GET entidades", "Error al obtener entidades", 500, error);
  }
}

// POST /api/licitaciones/entidades - Crear nueva entidad
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const data = await req.json();
    const { key, nombreOficial } = data;

    if (!key || !nombreOficial) {
      return NextResponse.json(
        { error: "Key y nombre oficial son requeridos" },
        { status: 400 }
      );
    }

    const entidad = await prisma.entidadLicitacion.create({
      data: {
        key,
        nombreOficial,
      },
    });

    return NextResponse.json(entidad, { status: 201 });
  } catch (error: unknown) {
    return apiError("Licitaciones", "POST entidad", "Error al crear entidad", 500, error);
  }
}
