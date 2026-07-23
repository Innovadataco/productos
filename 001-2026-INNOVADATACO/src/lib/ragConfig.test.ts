import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import {
  PARAMETROS_RAG_DEFAULT,
  mezclarParametros,
  parseConfigModelo,
  resolverModeloEmbeddings,
  ModeloEmbeddingsNoConfigurado,
} from "./ragConfig";

describe("mezclarParametros — precedencia §0.7 (FR-024)", () => {
  it("sin config devuelve los defaults documentados", () => {
    expect(mezclarParametros({})).toEqual(PARAMETROS_RAG_DEFAULT);
  });

  it("el default de troceado es estructural/1800 (medidos) y solape 200 (no medido, D-029)", () => {
    expect(PARAMETROS_RAG_DEFAULT.strategy).toBe("estructural");
    expect(PARAMETROS_RAG_DEFAULT.maxChars).toBe(1800);
    expect(PARAMETROS_RAG_DEFAULT.overlapChars).toBe(200);
  });

  it("el enriquecimiento está apagado por defecto (D-031)", () => {
    expect(PARAMETROS_RAG_DEFAULT.enriquecimiento.aplicar).toBe(false);
  });

  it("los valores del config del modelo (BD/UI) mandan sobre el default", () => {
    const p = mezclarParametros({ rag: { maxChars: 1000, topK: 10, pesoVectorial: 2 } });
    expect(p.maxChars).toBe(1000);
    expect(p.topK).toBe(10);
    expect(p.pesoVectorial).toBe(2);
    expect(p.overlapChars).toBe(200); // lo no especificado conserva el default
  });

  it("acepta el config plano (sin envoltorio 'rag')", () => {
    expect(mezclarParametros({ maxChars: 900 }).maxChars).toBe(900);
  });

  it("ignora valores no numéricos y cae al default (robustez)", () => {
    const p = mezclarParametros({ rag: { maxChars: "no-es-numero", topK: null } });
    expect(p.maxChars).toBe(1800);
    expect(p.topK).toBe(5);
  });

  it("lee la config de enriquecimiento cuando se activa", () => {
    const p = mezclarParametros({ rag: { enriquecimiento: { aplicar: true, campos: ["tipo", "numero"] } } });
    expect(p.enriquecimiento).toEqual({ aplicar: true, campos: ["tipo", "numero"] });
  });
});

describe("parseConfigModelo", () => {
  it("degrada a {} ante JSON inválido, sin lanzar", () => {
    expect(parseConfigModelo("no es json")).toEqual({});
    expect(parseConfigModelo(null)).toEqual({});
    expect(parseConfigModelo("")).toEqual({});
  });
});

describe("resolverModeloEmbeddings — FR-023, FR-006", () => {
  beforeEach(() => {
    vi.mocked(prisma.moduleSetting.findUnique).mockReset();
    vi.mocked(prisma.aiModel.findUnique).mockReset();
  });

  it("resuelve el modelo desde ModuleSetting(base_oficial/embedding_model)", async () => {
    vi.mocked(prisma.moduleSetting.findUnique).mockResolvedValue({ aiModelId: "m1" } as never);
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue({
      id: "m1",
      modelPath: "nomic-embed-text",
      baseUrl: "http://gpu:11434",
      config: JSON.stringify({ rag: { maxChars: 1200 } }),
    } as never);

    const r = await resolverModeloEmbeddings(prisma as never);

    expect(r.modelPath).toBe("nomic-embed-text");
    expect(r.baseUrl).toBe("http://gpu:11434"); // baseUrl del modelo manda (§0.7)
    expect(r.parametros.maxChars).toBe(1200);
    expect(r.enrichConfigHuella).toBe("none"); // apagado por defecto
    expect(vi.mocked(prisma.moduleSetting.findUnique).mock.calls[0][0]).toMatchObject({
      where: { module_settingKey: { module: "base_oficial", settingKey: "embedding_model" } },
    });
  });

  it("sin el ajuste configurado lanza error explícito y NO adivina un modelo (FR-006)", async () => {
    vi.mocked(prisma.moduleSetting.findUnique).mockResolvedValue(null);

    await expect(resolverModeloEmbeddings(prisma as never)).rejects.toBeInstanceOf(
      ModeloEmbeddingsNoConfigurado,
    );
    expect(prisma.aiModel.findUnique).not.toHaveBeenCalled();
  });

  it("si el ajuste apunta a un modelo inexistente, lanza (no cae a findFirst active)", async () => {
    vi.mocked(prisma.moduleSetting.findUnique).mockResolvedValue({ aiModelId: "fantasma" } as never);
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue(null);

    await expect(resolverModeloEmbeddings(prisma as never)).rejects.toBeInstanceOf(
      ModeloEmbeddingsNoConfigurado,
    );
  });
});
