import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { active } = await req.json();
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active boolean requerido" }, { status: 400 });
    }
    const updated = await prisma.agentApi.update({
      where: { id },
      data: { active },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return apiError("Configuración", "PATCH toggle API", "Error actualizando API", 500, err);
  }
}
