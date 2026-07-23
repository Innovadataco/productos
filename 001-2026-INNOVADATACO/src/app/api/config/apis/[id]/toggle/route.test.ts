import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { peticionJson } from "@/test/authMock";
import { PATCH } from "./route";

const url = "http://localhost:5001/api/config/apis/api1/toggle";
const params = { params: Promise.resolve({ id: "api1" }) };

describe("PATCH /api/config/apis/[id]/toggle", () => {
  beforeEach(() => {
    vi.mocked(prisma.agentApi.update).mockReset();
  });

  it("rechaza con 400 si active no es booleano", async () => {
    const res = await PATCH(peticionJson(url, { active: "sí" }, "PATCH"), params);

    expect(res.status).toBe(400);
    expect(prisma.agentApi.update).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si falta active", async () => {
    const res = await PATCH(peticionJson(url, {}, "PATCH"), params);

    expect(res.status).toBe(400);
  });

  it("activa la API cuando recibe active: true", async () => {
    vi.mocked(prisma.agentApi.update).mockResolvedValue({ id: "api1", active: true } as never);

    const res = await PATCH(peticionJson(url, { active: true }, "PATCH"), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.agentApi.update).mock.calls[0][0]).toMatchObject({
      where: { id: "api1" },
      data: { active: true },
    });
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.agentApi.update).mockRejectedValue(new Error("registro ausente en 10.0.0.12"));

    const res = await PATCH(peticionJson(url, { active: false }, "PATCH"), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error actualizando API" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.12");
  });
});
