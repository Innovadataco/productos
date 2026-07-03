import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const baseUrl = (searchParams.get("baseUrl") || "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/tags`, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ models: [], error: `Ollama ${res.status}: ${text}` }, { status: 502 });
    }
    const data = await res.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      model: m.model,
      size: m.size,
      parameter_size: m.details?.parameter_size,
      family: m.details?.family,
    }));
    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json({ models: [], error: err.message || "No se pudo contactar Ollama" }, { status: 502 });
  }
}
