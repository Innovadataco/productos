import { describe, it, expect, beforeEach, vi } from "vitest";
import { primerArgumento } from "@/test/mockArgs";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { peticionJson } from "@/test/authMock";
import { POST } from "./route";

const url = "http://localhost:5001/api/documents/search";

function doc(extra: Record<string, unknown>) {
  return {
    id: "doc1",
    titulo: "",
    contenidoTexto: "",
    resumen: "",
    proposito: "",
    ...extra,
  };
}

describe("POST /api/documents/search", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoOficial.findMany).mockReset();
  });

  it("rechaza con 400 si falta la consulta", async () => {
    const res = await POST(peticionJson(url, {}));

    expect(res.status).toBe(400);
    expect(prisma.documentoOficial.findMany).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si la consulta no es texto", async () => {
    const res = await POST(peticionJson(url, { query: 42 }));

    expect(res.status).toBe(400);
  });

  it("puntúa por términos distintos presentes y ordena de mayor a menor", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([
      doc({ id: "sin-coincidencia", titulo: "Otro tema" }), // 0 términos
      doc({ id: "un-termino", titulo: "Contrato de suministro" }), // solo "contrato"
      doc({ id: "dos-terminos", titulo: "Contrato de obra pública" }), // "contrato" + "obra"
    ] as never);

    const res = await POST(peticionJson(url, { query: "contrato obra" }));
    const resultados = (await res.json()) as Array<{ id: string; score: number }>;

    expect(res.status).toBe(200);
    // Los que no puntúan se descartan; el resto va de mayor a menor score.
    expect(resultados.map((r) => r.id)).toEqual(["dos-terminos", "un-termino"]);
    expect(resultados.map((r) => r.score)).toEqual([2, 1]);
  });

  it("aplica los filtros opcionales al where", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([] as never);

    await POST(
      peticionJson(url, {
        query: "ley",
        tipo: "ley",
        entidad: "Minhacienda",
        sector: "Hacienda",
        fechaDesde: "2026-01-01",
      }),
    );

    const { where } = primerArgumento(vi.mocked(prisma.documentoOficial.findMany));
    expect(where).toMatchObject({
      activo: true,
      tipo: "ley",
      entidad: "Minhacienda",
      sector: "Hacienda",
    });
    expect(where?.fechaExpedicion).toHaveProperty("gte");
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.documentoOficial.findMany).mockRejectedValue(
      new Error("conexión perdida con 10.0.0.3"),
    );

    const res = await POST(peticionJson(url, { query: "ley" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error en búsqueda" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.3");
  });
});
