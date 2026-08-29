import { describe, it, expect, vi, afterEach } from "vitest";
import { vectorizar } from "@/lib/bi/embedding";

const fetchSpy = vi.spyOn(globalThis, "fetch");

afterEach(() => fetchSpy.mockReset());

describe("vectorizar (embedding nomic-embed-text)", () => {
    it("200 OK devuelve number[]", async () => {
        const vec = Array.from({ length: 768 }, (_, i) => i / 768);
        fetchSpy.mockResolvedValueOnce(
            new Response(JSON.stringify({ embedding: vec }), { status: 200 }),
        );
        const r = await vectorizar("hola");
        expect(Array.isArray(r)).toBe(true);
        expect(r?.length).toBe(768);
    });

    it("error de red devuelve null", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("boom"));
        const r = await vectorizar("hola");
        expect(r).toBeNull();
    });

    it("non-200 devuelve null", async () => {
        fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 500 }));
        const r = await vectorizar("hola");
        expect(r).toBeNull();
    });

    it("texto vacío devuelve null sin fetch", async () => {
        const r = await vectorizar("");
        expect(r).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
