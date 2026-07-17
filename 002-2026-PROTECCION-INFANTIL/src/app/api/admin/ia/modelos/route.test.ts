import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

const mockListModels = vi.fn();

vi.mock("@/lib/ai/ollama-config", () => ({
    listOllamaModels: () => mockListModels(),
}));

describe("GET /api/admin/ia/modelos", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockListModels.mockReset();
    });

    it("returns installed models excluding embeddings", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        mockListModels.mockResolvedValue([
            { name: "ornith", tag: "9b", size: 6_000_000_000, modifiedAt: "2026-07-15", esEmbedding: false },
            { name: "nomic-embed-text", tag: "latest", size: 200_000_000, modifiedAt: "2026-07-15", esEmbedding: true },
        ]);

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/modelos", null);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.models).toHaveLength(2);
        expect(body.models.find((m: { name: string }) => m.name === "ornith")).toBeDefined();
        expect(body.models.find((m: { name: string }) => m.name === "nomic-embed-text")).toBeDefined();
    });

    it("returns error when Ollama is unreachable", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        mockListModels.mockRejectedValue(new Error("Ollama no responde"));

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/modelos", null);
        const res = await GET(req);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.message).toContain("Ollama");
    });
});
