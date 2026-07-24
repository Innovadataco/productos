import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { apiError, noAutenticado } from "@/lib/apiError";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Expediente de una oportunidad (spec 006, US4). Sube documentos del proceso
 * (PDF/Excel) ADJUNTOS a la oportunidad.
 *
 * FRONTERA CRÍTICA (FR-013, RZ-3): esto NO es Base Oficial. NO se extrae texto,
 * NO se encola, NO se generan chunks ni embeddings. Es un adjunto, no una fuente
 * del RAG. Este archivo no importa NADA del pipeline documental.
 */

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (§2.6)

// Tipos aceptados: PDF y Excel. Se valida por extensión (fiable) y, si viene,
// por MIME. Un .exe o una imagen se rechazan.
const EXTENSIONES = [".pdf", ".xlsx", ".xls"];

function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

function saneaNombre(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// POST /api/licitaciones/[id]/documentos - Adjuntar un documento al expediente
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const oportunidad = await prisma.licitacion.findUnique({ where: { id } });
    if (!oportunidad) {
      return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const nombre = (form.get("nombre") as string) || "";
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    const ext = extensionDe(file.name);
    if (!EXTENSIONES.includes(ext)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo PDF o Excel (.pdf, .xlsx, .xls)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo (10 MB)" },
        { status: 413 }
      );
    }

    // Guardar el archivo con nombre generado (nunca el original directo, §5.3).
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = join(process.cwd(), "uploads", "expedientes");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}_${saneaNombre(file.name)}`;
    await writeFile(join(uploadDir, fileName), buffer);

    // Crear el registro del expediente. NO se extrae texto ni se encola: es un
    // adjunto, no una fuente de Base Oficial (FR-013).
    const documento = await prisma.licitacionDocumento.create({
      data: {
        nombre: nombre || file.name,
        tipo: ext.replace(".", ""), // "pdf" | "xlsx" | "xls"
        contenido: `/uploads/expedientes/${fileName}`,
        licitacionId: id,
      },
    });

    return NextResponse.json(documento, { status: 201 });
  } catch (error: unknown) {
    return apiError("Oportunidades", "POST expediente", "Error al subir el documento", 500, error);
  }
}

// GET /api/licitaciones/[id]/documentos - Listar el expediente de la oportunidad
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { id } = await params;

    const documentos = await prisma.licitacionDocumento.findMany({
      where: { licitacionId: id },
      select: { id: true, nombre: true, tipo: true, contenido: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documentos);
  } catch (error: unknown) {
    return apiError("Oportunidades", "GET expediente", "Error al listar el expediente", 500, error);
  }
}
