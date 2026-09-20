import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "../../lib/prisma";
import { ensureDir, getUploadDir, saveFile, safeFileName } from "../../lib/upload";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const tipoDocumento = (formData.get("tipo") as string) || "OTRO";
  const oportunidadId = formData.get("oportunidadId") as string | null;
  const proyectoId = formData.get("proyectoId") as string | null;
  const email = formData.get("email") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (!oportunidadId && !proyectoId) {
    return NextResponse.json({ error: "Se requiere oportunidadId o proyectoId" }, { status: 400 });
  }

  const usuario = await prisma.user.findFirst({
    where: email ? { email } : { rol: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const relacion = oportunidadId ? "oportunidad" : "proyecto";
  const entidadId = (oportunidadId || proyectoId) as string;
  const dir = getUploadDir(relacion, entidadId);
  await ensureDir(dir);

  const fileName = safeFileName(file.name);
  const filePath = await saveFile(file, dir, fileName);
  const relativePath = path.relative(path.join(process.cwd(), "uploads"), filePath);

  const documento = await prisma.documento.create({
    data: {
      nombre: file.name,
      archivoOriginal: file.name,
      ruta: relativePath.replace(/\\/g, "/"),
      mimeType: file.type || "application/octet-stream",
      tamanioBytes: file.size,
      tipo: tipoDocumento,
      oportunidadId: oportunidadId || undefined,
      proyectoId: proyectoId || undefined,
      subidoPorId: usuario.id,
    },
    include: { subidoPor: true },
  });

  return NextResponse.json(documento, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oportunidadId = searchParams.get("oportunidadId");
  const proyectoId = searchParams.get("proyectoId");

  if (!oportunidadId && !proyectoId) {
    return NextResponse.json([]);
  }

  const filtros: { OR: Array<{ oportunidadId?: string; proyectoId?: string }> } = { OR: [] };
  if (oportunidadId) filtros.OR.push({ oportunidadId });
  if (proyectoId) filtros.OR.push({ proyectoId });

  const documentos = await prisma.documento.findMany({
    where: filtros,
    include: { subidoPor: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documentos);
}
