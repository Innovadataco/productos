import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { getOllamaBaseUrl, listOllamaModels } from "@/lib/ai/ollama-config";

vi.mock("@/lib/ai/ollama-config", () => ({
    getOllamaBaseUrl: vi.fn().mockResolvedValue("http://localhost:11434"),
    listOllamaModels: vi.fn(),
    isLocalOllamaUrl: vi.fn().mockReturnValue(true),
}));

function buildRequest() {
    return new Request("http://localhost/api/admin/ia/ollama/probar", { method: "POST" });
}

describe("POST /api/admin/ia/ollama/probar", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        vi.mocked(getOllamaBaseUrl).mockResolvedValue("http://localhost:11434");
    });

    it("sondea la URL configurada como fuente única y responde ok", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        vi.mocked(listOllamaModels).mockResolvedValue([
            { name: "ornith", tag: "9b", size: 1000, modifiedAt: "2026-07-27T00:00:00Z", esEmbedding: false },
            { name: "nomic-embed-text", tag: "latest", size: 500, modifiedAt: "2026-07-27T00:00:00Z", esEmbedding: true },
        ]);

        const res = await POST(buildRequest());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.url).toBe("http://localhost:11434");
        expect(body.modelosClasificacion).toEqual(["ornith:9b"]);
        expect(body.modelosEmbedding).toEqual(["nomic-embed-text:latest"]);
        expect(listOllamaModels).toHaveBeenCalledWith("http://localhost:11434");
    });

    it("degrada con respuesta controlada si Ollama es inalcanzable (fetch rechazado)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        vi.mocked(listOllamaModels).mockRejectedValue(
            Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } })
        );

        const res = await POST(buildRequest());
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe("Ollama inalcanzable");
        expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
});
