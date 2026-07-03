import { describe, it, expect } from "vitest";
import { testModel, callModel } from "./modelClients";

describe("modelClients", () => {
  it("mock provider returns valid JSON", async () => {
    const result = await testModel({ provider: "mock", modelPath: "mock", config: "{}" });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
    const parsed = JSON.parse(result.text);
    expect(parsed.titulo).toBeDefined();
  });

  it("unknown provider fails", async () => {
    const result = await callModel({ provider: "x", modelPath: "x", config: "{}" }, "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown provider");
  });
});
