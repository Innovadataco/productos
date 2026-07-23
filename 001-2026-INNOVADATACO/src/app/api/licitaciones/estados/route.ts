import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/estados - Listar todos los estados
export async function GET(req: NextRequest) {
  try {
    const estados = await prisma.licitacionStatus.findMany({
      orderBy: { id: "asc" },
    });

    return NextResponse.json(estados);
  } catch (error: unknown) {
    return apiError("Licitaciones", "GET estados", "Error al obtener estados", 500, error);
  }
}

// POST /api/licitaciones/estados - Crear nuevo estado
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { key, nombreOficial } = data;

    if (!key || !nombreOficial) {
      return NextResponse.json(
        { error: "Key y nombre oficial son requeridos" },
        { status: 400 }
      );
    }

    const estado = await prisma.licitacionStatus.create({
      data: {
        key,
        nombreOficial,
      },
    });

    return NextResponse.json(estado, { status: 201 });
  } catch (error: unknown) {
    return apiError("Licitaciones", "POST estado", "Error al crear estado", 500, error);
  }
}
