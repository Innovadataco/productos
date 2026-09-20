import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const fullPath = path.join(process.cwd(), "uploads", doc.ruta.replace(/\\/g, "/"));
  const buffer = await fs.readFile(fullPath);

  return new Response(buffer, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.archivoOriginal)}`,
    },
  });
}
