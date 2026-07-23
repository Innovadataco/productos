import { NextRequest, NextResponse } from "next/server";
import { detalleDeError, noAutenticado } from "@/lib/apiError";
import type { PgBoss } from "pg-boss";
import { Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/documentProcessor";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";

const TIPO_JERARQUIA: Record<string, number> = {
  constitucion: 1,
  ley: 2,
  decreto: 3,
  resolucion: 4,
  circular: 5,
  otro: 9,
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Singleton de pg-boss usando promesa para evitar condición de carrera
let bossPromise: Promise<PgBoss> | null = null;

async function getBoss() {
  if (!bossPromise) {
    bossPromise = (async () => {
      const { PgBoss } = await import("pg-boss");
      const instance = new PgBoss({
        connectionString: process.env.DATABASE_URL,
      });
      await instance.start();
      return instance;
    })();
  }
  return bossPromise;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const tipo = (form.get("tipo") as string) || "otro";
    const sector = (form.get("sector") as string) || "";
    const entidad = (form.get("entidad") as string) || "";
    const fechaExpedicion = (form.get("fechaExpedicion") as string) || null;
    const numero = (form.get("numero") as string) || "";
    const titulo = (form.get("titulo") as string) || "";
    const padreId = (form.get("padreId") as string) || null;

    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    // Extraer texto del PDF
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let texto = "";
    let extractionError: string | null = null;
    try {
      texto = await extractPdfText(buffer);
    } catch (err: unknown) {
      extractionError = detalleDeError(err);
      console.warn("[Documentos] Extracción de PDF: advertencia —", extractionError);
    }

    // Guardar archivo
    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Determinar estado inicial
    const initialStatus = extractionError ? "needs_review" : "queued";

    // Crear documento en BD con estado "queued"
    const doc = await prisma.documentoOficial.create({
      data: {
        titulo: titulo || file.name.replace(/\.pdf$/i, ""),
        tipo,
        entidad: entidad || "Pendiente",
        sector: sector || "Otro",
        archivoUrl: `/uploads/${fileName}`,
        contenidoTexto: texto,
        status: initialStatus,
        processingError: extractionError,
        jerarquiaNivel: TIPO_JERARQUIA[tipo] ?? 9,
        padreId,
        aiModelId: null,
      },
    });

    await auditLog({
      action: "upload_pdf",
      entityType: "DocumentoOficial",
      entityId: doc.id,
      status: extractionError ? "error" : "info",
      message: extractionError || "PDF subido, encolado para procesamiento",
    });

    // Si hubo error de extracción, no encolar - ya está en needs_review
    if (!extractionError) {
      try {
        const bossInstance = await getBoss();
        await bossInstance.send("process-document", { documentId: doc.id });
        console.log(`[API] Documento ${doc.id} encolado para procesamiento`);
      } catch (queueError) {
        console.error("[API] Error encolando documento:", queueError);
        // Actualizar a needs_review si no se pudo encolar
        await prisma.documentoOficial.update({
          where: { id: doc.id },
          data: { status: "needs_review", processingError: "Error encolando para procesamiento" },
        });
      }
    }

    // Responder INMEDIATAMENTE con el documento creado
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(err);
    await auditLog({ action: "upload_pdf", entityType: "DocumentoOficial", status: "error", message: "Error procesando documento" });
    return NextResponse.json({ error: "Error procesando documento" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const status = searchParams.get("status");

    const where: Prisma.DocumentoOficialWhereInput = includeInactive ? {} : { activo: true };
    if (status) {
      where.status = status;
    }

    const docs = await prisma.documentoOficial.findMany({
      where,
      orderBy: [{ jerarquiaNivel: "asc" }, { fechaExpedicion: "desc" }],
      include: { padre: { select: { id: true, titulo: true, tipo: true } } },
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }
}

// Campos editables permitidos en PATCH
const EDITABLE_FIELDS = [
  "titulo",
  "tipo",
  "entidad",
  "sector",
  "numero",
  "fechaExpedicion",
  "resumen",
  "proposito",
  "actores",
  "motivacion",
  "resuelve",
  "status",
];

function parseDateSafe(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  try {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // Whitelist: solo permitir campos editables
    const data: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        if (key === "fechaExpedicion") {
          data[key] = parseDateSafe(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    const updated = await prisma.documentoOficial.update({ where: { id }, data });
    await auditLog({ action: "update_document", entityType: "DocumentoOficial", entityId: id, status: "success", message: "Documento actualizado", metadata: data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error actualizando documento" }, { status: 500 });
  }
}
