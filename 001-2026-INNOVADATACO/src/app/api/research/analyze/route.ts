import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callModel } from "@/lib/modelClients";
import { buildResearchPrompt, sanitizeJsonText } from "@/lib/prompts";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { documentId, text } = await req.json();

    let content = "";
    if (documentId) {
      const doc = await prisma.documentoOficial.findUnique({ where: { id: documentId } });
      if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
      content = doc.contenidoTexto;
    } else if (text) {
      content = text;
    } else {
      return NextResponse.json({ error: "documentId o text requerido" }, { status: 400 });
    }

    const activeModel = await prisma.aiModel.findFirst({ where: { active: true } });
    if (!activeModel) {
      return NextResponse.json({ error: "Sin modelo IA activo" }, { status: 503 });
    }

    const prompt = buildResearchPrompt(content);
    const result = await callModel(activeModel, prompt);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, latencyMs: result.latencyMs }, { status: 502 });
    }

    let analysis: Record<string, any> | null = null;
    try {
      analysis = JSON.parse(sanitizeJsonText(result.text));
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: `JSON inválido: ${err.message}`, rawText: result.text, latencyMs: result.latencyMs }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      analysis,
      rawText: result.text,
      latencyMs: result.latencyMs,
      usage: result.usage,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Error en análisis" }, { status: 500 });
  }
}
