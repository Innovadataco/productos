import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/licitaciones/entidades - Listar todas las entidades
export async function GET(req: NextRequest) {
  try {
    const entidades = await prisma.entidadLicitacion.findMany({
      orderBy: { nombreOficial: "asc" },
    });

    return NextResponse.json(entidades);
  } catch (error: any) {
    console.error("Error al obtener entidades:", error);
    return NextResponse.json(
      { error: "Error al obtener entidades", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/licitaciones/entidades - Crear nueva entidad
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

    const entidad = await prisma.entidadLicitacion.create({
      data: {
        key,
        nombreOficial,
      },
    });

    return NextResponse.json(entidad, { status: 201 });
  } catch (error: any) {
    console.error("Error al crear entidad:", error);
    return NextResponse.json(
      { error: "Error al crear entidad", details: error.message },
      { status: 500 }
    );
  }
}
