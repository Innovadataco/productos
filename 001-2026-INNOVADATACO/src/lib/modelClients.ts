import { sanitizeJsonText } from "./prompts";

export interface ModelConfig {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}

export interface ModelResult {
  ok: boolean;
  text: string;
  rawText?: string;
  latencyMs: number;
  error?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface AiModelInput {
  id?: string;
  provider: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  modelPath: string;
  config: string;
}

function parseConfig(config: string): ModelConfig {
  try {
    return JSON.parse(config || "{}") as ModelConfig;
  } catch {
    return {};
  }
}

async function ollamaCall(model: AiModelInput, prompt: string): Promise<ModelResult> {
  const start = Date.now();
  const cfg = parseConfig(model.config);
  const baseUrl = (model.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.modelPath,
      prompt,
      system: cfg.systemPrompt || "Eres un asistente experto en documentos legales colombianos. Responde ÚNICAMENTE con JSON válido.",
      stream: false,
      options: {
        temperature: cfg.temperature ?? 0.2,
        top_p: cfg.top_p ?? 0.9,
        num_predict: cfg.max_tokens ?? 1024,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, text: "", latencyMs: Date.now() - start, error: `Ollama ${res.status}: ${text}` };
  }
  const data = await res.json();
  return {
    ok: true,
    text: data.response ?? "",
    latencyMs: Date.now() - start,
    usage: data.prompt_eval_count || data.eval_count ? {
      prompt_tokens: data.prompt_eval_count,
      completion_tokens: data.eval_count,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    } : undefined,
  };
}

async function openaiCall(model: AiModelInput, prompt: string): Promise<ModelResult> {
  const start = Date.now();
  const cfg = parseConfig(model.config);
  const res = await fetch(`${model.baseUrl || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey || process.env.OPENAI_APIKEY || ""}`,
    },
    body: JSON.stringify({
      model: model.modelPath,
      messages: [
        { role: "system", content: cfg.systemPrompt || "Eres un asistente experto en documentos legales colombianos. Responde ÚNICAMENTE con JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: cfg.temperature ?? 0.2,
      top_p: cfg.top_p ?? 0.9,
      max_tokens: cfg.max_tokens ?? 1024,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, text: "", latencyMs: Date.now() - start, error: `OpenAI ${res.status}: ${text}` };
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    ok: true,
    text: choice?.message?.content ?? "",
    latencyMs: Date.now() - start,
    usage: data.usage,
  };
}

async function mockCall(_model: AiModelInput, prompt: string): Promise<ModelResult> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 200));
  return {
    ok: true,
    text: JSON.stringify({
      titulo: "Mock extraído",
      numero: "12345",
      entidad: "Mock Entidad",
      sector: "Transporte",
      fecha: "2024-01-01",
      resumen: prompt.slice(0, 100),
      proposito: "Mock",
      actores: "Mock",
      motivacion: "Mock",
      resuelve: "Mock",
    }),
    latencyMs: Date.now() - start,
    usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
  };
}

export function callModel(model: AiModelInput, prompt: string): Promise<ModelResult> {
  switch (model.provider) {
    case "ollama": return ollamaCall(model, prompt);
    case "openai": return openaiCall(model, prompt);
    case "mock": return mockCall(model, prompt);
    default: return Promise.resolve({ ok: false, text: "", latencyMs: 0, error: `Unknown provider ${model.provider}` });
  }
}

export async function testModel(model: AiModelInput): Promise<ModelResult> {
  const prompt = "Responde con un objeto JSON v\u00e1lido exactamente as\u00ed: {\"ok\": true, \"message\": \"modelo activo\"}. No uses markdown, no expliques.";
  const result = await callModel(model, prompt);
  if (!result.ok) return result;
  const rawText = result.text;
  const cleaned = sanitizeJsonText(result.text);
  return { ...result, rawText, text: cleaned };
}
