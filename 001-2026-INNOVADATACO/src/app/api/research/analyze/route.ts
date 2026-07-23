import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
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
    } catch (err: unknown) {
      // rawText/latencyMs son datos legítimos de la respuesta; el detalle del
      // error de parseo va solo al log del servidor.
      return apiError("Investigación", "POST analyze", "El modelo devolvió un JSON inválido", 502, err, {
        ok: false,
        rawText: result.text,
        latencyMs: result.latencyMs,
      });
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
