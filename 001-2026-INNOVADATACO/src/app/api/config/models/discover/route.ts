import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { resolveOllamaBaseUrl } from "@/lib/modelClients";

/** Forma de la respuesta de `GET {baseUrl}/api/tags` de Ollama (solo lo que usamos). */
interface OllamaModelTag {
  name: string;
  model: string;
  size?: number;
  details?: {
    parameter_size?: string;
    family?: string;
  };
}

interface OllamaTagsResponse {
  models?: OllamaModelTag[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // FR-010: el baseUrl explícito manda; OLLAMA_BASEURL solo reemplaza el fallback
    const baseUrl = resolveOllamaBaseUrl(searchParams.get("baseUrl"));
    const res = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ models: [], error: `Ollama ${res.status}: ${text}` }, { status: 502 });
    }
    const data: OllamaTagsResponse = await res.json();
    const models = (data.models || []).map((m: OllamaModelTag) => ({
      name: m.name,
      model: m.model,
      size: m.size,
      parameter_size: m.details?.parameter_size,
      family: m.details?.family,
    }));
    return NextResponse.json({ models });
  } catch (err: unknown) {
    return apiError("Configuración", "GET discover", "No se pudo contactar Ollama", 502, err, { models: [] });
  }
}
