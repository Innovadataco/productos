import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../../../lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const fullPath = path.join(process.cwd(), "uploads", doc.ruta.replace(/\\/g, "/"));
  try {
    await fs.unlink(fullPath);
  } catch {
    // Si el archivo ya no existe en disco, continuamos para limpiar la BD.
  }

  await prisma.documento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
