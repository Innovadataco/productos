import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
// Sin inferencia real: el modelo se mockea (ADR_002, trabajo pesado).
vi.mock("@/lib/modelClients", () => ({ callModel: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { callModel } from "@/lib/modelClients";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { POST } from "./route";

const url = "http://localhost:5001/api/research/analyze";
const MODELO_ACTIVO = { id: "m1", name: "Qwen", provider: "ollama", modelPath: "qwen", config: "{}" };

describe("POST /api/research/analyze", () => {
  beforeEach(() => {
    vi.mocked(prisma.aiModel.findFirst).mockReset();
    vi.mocked(prisma.documentoOficial.findUnique).mockReset();
    vi.mocked(callModel).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, { text: "texto" }));

    expect(res.status).toBe(401);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si no se envía documentId ni text", async () => {
    await conSesion();

    const res = await POST(peticionJson(url, {}));

    expect(res.status).toBe(400);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("responde 404 si el documento no existe", async () => {
    await conSesion();
    vi.mocked(prisma.documentoOficial.findUnique).mockResolvedValue(null);

    const res = await POST(peticionJson(url, { documentId: "doc-inexistente" }));

    expect(res.status).toBe(404);
  });

  it("responde 503 si no hay modelo IA activo (§2.4)", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.findFirst).mockResolvedValue(null);

    const res = await POST(peticionJson(url, { text: "texto a analizar" }));

    expect(res.status).toBe(503);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("devuelve el análisis cuando el modelo responde JSON válido", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.findFirst).mockResolvedValue(MODELO_ACTIVO as never);
    vi.mocked(callModel).mockResolvedValue({
      ok: true,
      text: JSON.stringify({ resumen: "Un resumen", hallazgos: [] }),
      latencyMs: 42,
    });

    const res = await POST(peticionJson(url, { text: "texto a analizar" }));
    const body = (await res.json()) as { ok: boolean; analysis: { resumen: string } };

    expect(res.status).toBe(200);
    expect(body.analysis.resumen).toBe("Un resumen");
  });

  it("responde 502 sin filtrar el detalle si el modelo devuelve JSON inválido (FR-004)", async () => {
    await conSesion();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.aiModel.findFirst).mockResolvedValue(MODELO_ACTIVO as never);
    vi.mocked(callModel).mockResolvedValue({
      ok: true,
      text: "esto no es JSON",
      latencyMs: 10,
    });

    const res = await POST(peticionJson(url, { text: "texto" }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(502);
    expect(body.error).toBe("El modelo devolvió un JSON inválido");
    // rawText y latencyMs son datos legítimos de la respuesta...
    expect(body.rawText).toBe("esto no es JSON");
    expect(body.latencyMs).toBe(10);
    // ...pero el detalle de la excepción de parseo no se filtra.
    expect(JSON.stringify(body)).not.toContain("JSON.parse");
    expect(JSON.stringify(body)).not.toContain("Unexpected token");
  });
});
