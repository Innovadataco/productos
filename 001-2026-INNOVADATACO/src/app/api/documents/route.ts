import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { extractPdfText, analyzeDocument } from "@/lib/documentProcessor";

const TIPO_JERARQUIA: Record<string, number> = {
  constitucion: 1,
  ley: 2,
  decreto: 3,
  resolucion: 4,
  circular: 5,
  otro: 9,
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const tipo = (form.get("tipo") as string) || "otro";
    const entidad = (form.get("entidad") as string) || "";
    const fechaExpedicion = (form.get("fechaExpedicion") as string) || null;
    const numero = (form.get("numero") as string) || "";
    const titulo = (form.get("titulo") as string) || file?.name || "Sin título";
    const padreId = (form.get("padreId") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const texto = await extractPdfText(buffer);
    const analisis = analyzeDocument(texto);

    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const doc = await prisma.documentoOficial.create({
      data: {
        titulo,
        tipo,
        entidad,
        fechaExpedicion: fechaExpedicion ? new Date(fechaExpedicion) : null,
        numero,
        archivoUrl: `/uploads/${fileName}`,
        contenidoTexto: texto,
        resumen: analisis.resumen,
        proposito: analisis.proposito,
        actores: analisis.actores,
        motivacion: analisis.motivacion,
        resuelve: analisis.resuelve,
        jerarquiaNivel: TIPO_JERARQUIA[tipo] ?? 9,
        padreId,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error procesando documento" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const docs = await prisma.documentoOficial.findMany({
      orderBy: [{ jerarquiaNivel: "asc" }, { fechaExpedicion: "desc" }],
      include: { padre: { select: { id: true, titulo: true, tipo: true } } },
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }
}
