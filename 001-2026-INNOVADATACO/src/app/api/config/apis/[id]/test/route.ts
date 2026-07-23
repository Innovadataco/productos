import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { resolveOllamaBaseUrl } from "@/lib/modelClients";

export const dynamic = "force-dynamic";

async function resolvePlaceholder(key: string): Promise<string> {
  if (key === "modelId") {
    const m = await prisma.aiModel.findFirst({ orderBy: { createdAt: "desc" } });
    return m?.id || "";
  }
  if (key === "documentId") {
    const d = await prisma.documentoOficial.findFirst({ orderBy: { createdAt: "desc" } });
    return d?.id || "";
  }
  if (key === "apiId") {
    const a = await prisma.agentApi.findFirst({ orderBy: { createdAt: "desc" } });
    return a?.id || "";
  }
  return "";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id } = await params;
    const api = await prisma.agentApi.findUnique({ where: { id } });
    if (!api) return NextResponse.json({ error: "API no encontrada" }, { status: 404 });
    if (!api.active) return NextResponse.json({ error: "API inactiva" }, { status: 403 });

    const origin = req.nextUrl.origin;
    const cfg = JSON.parse(api.config || "{}") as Record<string, string>;

    let url = api.path;
    let body: string | null = null;
    const headers: Record<string, string> = {};

    // Placeholders internos
    if (url.includes("{id}")) {
      let realId = "";
      if (api.module === "configuracion" && api.submodule === "modelos_ia") realId = await resolvePlaceholder("modelId");
      else if (api.module === "base_oficial") realId = await resolvePlaceholder("documentId");
      else realId = await resolvePlaceholder("apiId");
      if (!realId) return NextResponse.json({ error: "No hay recurso de prueba disponible" }, { status: 400 });
      url = url.replace("{id}", realId);
    }

    if (url.includes("{baseUrl}")) {
      // FR-010: el baseUrl de la config (BD/UI) manda; la env var solo es fallback
      url = url.replace("{baseUrl}", resolveOllamaBaseUrl(cfg.baseUrl));
    }

    // Construir body según API
    switch (api.key) {
      case "search_documents":
        body = JSON.stringify({ query: "prueba" });
        headers["Content-Type"] = "application/json";
        break;
      case "analyze_document":
        body = JSON.stringify({ text: "Este es un texto de prueba para Odin Analysis en Innovadataco." });
        headers["Content-Type"] = "application/json";
        break;
      case "test_model": {
        const modelId = await resolvePlaceholder("modelId");
        if (!modelId) return NextResponse.json({ error: "Sin modelo para testear" }, { status: 400 });
        body = JSON.stringify({ id: modelId });
        headers["Content-Type"] = "application/json";
        break;
      }
      case "discover_models":
        url = url.replace("{baseUrl}", resolveOllamaBaseUrl(cfg.baseUrl));
        break;
      case "list_audit":
        url = url.replace("{limit}", "5");
        break;
      case "openai_api": {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 400 });
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hola" }] });
        break;
      }
      case "upload_document":
      case "create_model":
      case "update_model":
      case "delete_model":
      case "toggle_api":
        return NextResponse.json({ skipped: true, reason: "Operación destructiva o que requiere datos adicionales; usar la UI del módulo correspondiente." });
      default:
        // GETs sin body
        break;
    }

    const targetUrl = api.category === "internal" ? `${origin}${url}` : url;

    const res = await fetch(targetUrl, {
      method: api.method,
      headers,
      body,
    });

    const text = await res.text();
    // La respuesta puede ser JSON de cualquier forma o texto plano.
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      url: targetUrl,
      response: data,
    });
  } catch (err: unknown) {
    return apiError("Configuración", "POST test API", "Error ejecutando la prueba de la API", 500, err, {
      ok: false,
      latencyMs: Date.now() - start,
    });
  }
}
