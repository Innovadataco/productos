import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry } from "./fetch-retry";

describe("fetchWithRetry", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("devuelve respuesta OK sin reintentar", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
        global.fetch = fetchMock;

        const res = await fetchWithRetry("http://test/api");
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("no reintenta errores 4xx", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 403 }));
        global.fetch = fetchMock;

        const res = await fetchWithRetry("http://test/api");
        expect(res.status).toBe(403);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reintenta errores 5xx hasta 3 veces y luego falla", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("error", { status: 503 }));
        global.fetch = fetchMock;

        await expect(fetchWithRetry("http://test/api", { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow("HTTP 503");
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("reintenta errores de red y eventualmente resuelve", async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new Error("network error"))
            .mockResolvedValue(new Response("ok", { status: 200 }));
        global.fetch = fetchMock;

        const res = await fetchWithRetry("http://test/api", { maxRetries: 3, baseDelayMs: 0 });
        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
