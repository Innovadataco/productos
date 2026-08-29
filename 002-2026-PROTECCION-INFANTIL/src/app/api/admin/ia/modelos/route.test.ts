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

    it("degrada a 503 estructurado cuando Ollama es inalcanzable (mismo patrón que el sondeo de I-24)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        mockListModels.mockRejectedValue(new Error("Ollama no responde"));

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/modelos", null);
        const res = await GET(req);
        // Un cerebro caído no es un 500: el Centro de Control recibe la respuesta
        // degradada del contrato hermano (/api/admin/ia/ollama/probar).
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
        expect(body.error.message).toContain("Ollama inalcanzable");
    });
});
