import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
// La búsqueda híbrida y el modelo/embedding se mockean: la orquestación de la ruta
// se prueba sin BD ni Ollama. La corrección del SQL se valida en vivo (TP-2).
vi.mock("@/lib/search/hibrida", () => ({ buscarHibrida: vi.fn() }));
vi.mock("@/lib/ragConfig", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ragConfig")>("@/lib/ragConfig");
  return { ...actual, resolverModeloEmbeddings: vi.fn() };
});
vi.mock("@/lib/modelClients", () => ({ embedText: vi.fn() }));

import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { buscarHibrida } from "@/lib/search/hibrida";
import { resolverModeloEmbeddings, ModeloEmbeddingsNoConfigurado, PARAMETROS_RAG_DEFAULT } from "@/lib/ragConfig";
import { embedText } from "@/lib/modelClients";
import { POST } from "./route";

const url = "http://localhost:5001/api/documents/search";

const MODELO = {
  id: "m1",
  modelPath: "nomic-embed-text",
  baseUrl: "http://ollama:11434",
  parametros: PARAMETROS_RAG_DEFAULT,
  enrichConfigHuella: "none",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(buscarHibrida).mockReset().mockResolvedValue([]);
  vi.mocked(resolverModeloEmbeddings).mockReset().mockResolvedValue(MODELO as never);
  vi.mocked(embedText).mockReset().mockResolvedValue({ ok: true, embedding: [0.1], latencyMs: 1 } as never);
});

describe("POST /api/documents/search — sesión y validación", () => {
  it("rechaza con 401 sin sesión, sin consultar (spec 005)", async () => {
    await sinSesion();
    const res = await POST(peticionJson(url, { query: "taxi" }));
    expect(res.status).toBe(401);
    expect(buscarHibrida).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si falta la consulta", async () => {
    const res = await POST(peticionJson(url, {}));
    expect(res.status).toBe(400);
    expect(buscarHibrida).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si la consulta no es texto", async () => {
    const res = await POST(peticionJson(url, { query: 42 }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/search — búsqueda híbrida (US4)", () => {
  it("delega en buscarHibrida y devuelve sus resultados con puntuación", async () => {
    vi.mocked(buscarHibrida).mockResolvedValue([
      { id: "d1", titulo: "Resolución 1234", score: 0.9, fuente: "ambas" },
    ] as never);

    const res = await POST(peticionJson(url, { query: "tarifas de taxi" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: "d1", score: 0.9, fuente: "ambas" });
  });

  it("pasa los filtros de metadatos a la búsqueda (FR-014)", async () => {
    await POST(
      peticionJson(url, { query: "taxi", tipo: "decreto", entidad: "MinTransporte", fechaDesde: "2020-01-01" }),
    );

    expect(vi.mocked(buscarHibrida).mock.calls[0][1]).toMatchObject({
      query: "taxi",
      filtros: { tipo: "decreto", entidad: "MinTransporte", fechaDesde: "2020-01-01" },
      embeddingModel: "nomic-embed-text",
      enrichConfig: "none",
    });
  });

  it("usa el embedding de la consulta cuando el modelo responde", async () => {
    vi.mocked(embedText).mockResolvedValue({ ok: true, embedding: [0.1, 0.2], latencyMs: 1 } as never);

    await POST(peticionJson(url, { query: "requisitos de terminales" }));

    expect(vi.mocked(buscarHibrida).mock.calls[0][1].queryEmbedding).toEqual([0.1, 0.2]);
  });

  it("degrada a solo FTS si no hay modelo de embeddings configurado (US4-4)", async () => {
    vi.mocked(resolverModeloEmbeddings).mockRejectedValue(
      new ModeloEmbeddingsNoConfigurado("sin ajuste"),
    );

    const res = await POST(peticionJson(url, { query: "taxi" }));

    expect(res.status).toBe(200);
    const arg = vi.mocked(buscarHibrida).mock.calls[0][1];
    expect(arg.queryEmbedding).toBeNull();
    expect(arg.embeddingModel).toBe("");
    expect(embedText).not.toHaveBeenCalled();
  });

  it("degrada a solo FTS si el embedding de la consulta falla (Ollama caído)", async () => {
    vi.mocked(embedText).mockResolvedValue({ ok: false, embedding: [], latencyMs: 1, error: "caído" } as never);

    await POST(peticionJson(url, { query: "taxi" }));

    expect(vi.mocked(buscarHibrida).mock.calls[0][1].queryEmbedding).toBeNull();
  });

  it("no filtra err.message al cliente ante un fallo interno (FR-018)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(buscarHibrida).mockRejectedValue(new Error("timeout en db:5432"));

    const res = await POST(peticionJson(url, { query: "taxi" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error en búsqueda" });
    expect(JSON.stringify(body)).not.toContain("db:5432");
  });
});
