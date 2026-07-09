import { describe, it, expect } from "vitest";
import { testModel, callModel } from "./modelClients";

describe("modelClients", () => {
  it("mock provider returns raw text response with exact LLM params", async () => {
    const result = await testModel({ provider: "mock", modelPath: "mock", config: "{}" });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.rawText).toBe(result.text);
    expect(result.text).toContain("Mock extraído");
  });

  it("unknown provider fails", async () => {
    const result = await callModel({ provider: "x", modelPath: "x", config: "{}" }, "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown provider");
  });
});
