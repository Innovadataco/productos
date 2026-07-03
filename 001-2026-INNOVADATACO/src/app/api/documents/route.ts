import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { extractPdfText, analyzeDocument } from "@/lib/documentProcessor";
import { callModel } from "@/lib/modelClients";
import { buildDocumentAnalysisPrompt, sanitizeJsonText } from "@/lib/prompts";
import { auditLog } from "@/lib/audit";

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

export async function POST(req: NextRequest) {
  try {
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const texto = await extractPdfText(buffer);

    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const doc = await prisma.documentoOficial.create({
      data: {
        titulo: titulo || "Procesando...",
        tipo,
        entidad: entidad || "Pendiente",
        sector: sector || "Otro",
        archivoUrl: `/uploads/${fileName}`,
        contenidoTexto: texto,
        status: "processing",
        jerarquiaNivel: TIPO_JERARQUIA[tipo] ?? 9,
        padreId,
      },
    });

    await auditLog({ action: "upload_pdf", entityType: "DocumentoOficial", entityId: doc.id, status: "info", message: "PDF subido, iniciando procesamiento" });

    const activeModel = await prisma.aiModel.findFirst({ where: { active: true } });
    let metadata: Record<string, any> | null = null;
    let processingError: string | null = null;
    let aiModelId: string | undefined = activeModel?.id || undefined;

    if (activeModel) {
      const prompt = buildDocumentAnalysisPrompt(texto);
      await auditLog({ action: "process_start", entityType: "DocumentoOficial", entityId: doc.id, status: "info", message: `Procesando con ${activeModel.name}`, aiModelId });
      const result = await callModel(activeModel, prompt);

      if (result.ok) {
        try {
          metadata = JSON.parse(sanitizeJsonText(result.text));
          await auditLog({
            action: "process_end",
            entityType: "DocumentoOficial",
            entityId: doc.id,
            status: "success",
            message: "Procesamiento IA completado",
            metadata: { usage: result.usage },
            latencyMs: result.latencyMs,
            aiModelId,
          });
        } catch (err: any) {
          processingError = `JSON inválido: ${err.message}`;
          await auditLog({ action: "process_end", entityType: "DocumentoOficial", entityId: doc.id, status: "error", message: processingError, aiModelId });
        }
      } else {
        processingError = result.error || "Modelo no respondió";
        await auditLog({ action: "process_end", entityType: "DocumentoOficial", entityId: doc.id, status: "error", message: processingError, latencyMs: result.latencyMs, aiModelId });
      }
    } else {
      processingError = "Sin modelo IA activo. Usando extracción por reglas.";
      await auditLog({ action: "process_end", entityType: "DocumentoOficial", entityId: doc.id, status: "error", message: processingError });
    }

    const fallback = analyzeDocument(texto);
    const final = {
      titulo: titulo || metadata?.titulo || fallback.titulo || "Sin título",
      sector: sector || metadata?.sector || fallback.sector || "Otro",
      entidad: entidad || metadata?.entidad || fallback.entidad || "Otra",
      numero: numero || metadata?.numero || fallback.numero,
      fechaExpedicion: parseDate(fechaExpedicion) || parseDate(metadata?.fecha) || parseDate(fallback.fecha),
      resumen: metadata?.resumen || fallback.resumen,
      proposito: metadata?.proposito || fallback.proposito,
      actores: metadata?.actores || fallback.actores,
      motivacion: metadata?.motivacion || fallback.motivacion,
      resuelve: metadata?.resuelve || fallback.resuelve,
      status: processingError ? "needs_review" : "completed",
      processingError,
      aiModelId,
    };

    const updated = await prisma.documentoOficial.update({ where: { id: doc.id }, data: final });
    return NextResponse.json(updated, { status: 201 });
  } catch (err: any) {
    console.error(err);
    await auditLog({ action: "upload_pdf", entityType: "DocumentoOficial", status: "error", message: err.message });
    return NextResponse.json({ error: err.message || "Error procesando documento" }, { status: 500 });
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
