import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFetchJson } from "./use-fetch-json";

type Payload = { items: number[] };

function mockFetchOk(payload: unknown) {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
    } as Response);
}

describe("useFetchJson", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("carga datos y apaga cargando", async () => {
        vi.stubGlobal("fetch", mockFetchOk({ items: [1, 2] }));
        const { result } = renderHook(() => useFetchJson<Payload>("/api/prueba"));
        expect(result.current.cargando).toBe(true);
        await waitFor(() => expect(result.current.cargando).toBe(false));
        expect(result.current.datos?.items).toEqual([1, 2]);
        expect(result.current.error).toBeNull();
    });

    it("expone error cuando la respuesta no es ok", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: { message: "Falla interna" } }),
            } as Response)
        );
        const { result } = renderHook(() => useFetchJson<Payload>("/api/prueba"));
        await waitFor(() => expect(result.current.cargando).toBe(false));
        expect(result.current.error).toBe("Falla interna");
        expect(result.current.datos).toBeNull();
    });

    it("expone error de red cuando fetch rechaza", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        const { result } = renderHook(() => useFetchJson<Payload>("/api/prueba"));
        await waitFor(() => expect(result.current.cargando).toBe(false));
        expect(result.current.error).toBe("Error de red al cargar la información.");
    });

    it("no hace fetch mientras la url es null", async () => {
        const fetchMock = mockFetchOk({ items: [] });
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useFetchJson<Payload>(null));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.cargando).toBe(true);
    });

    it("recargar vuelve a pedir los datos", async () => {
        const fetchMock = mockFetchOk({ items: [1] });
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useFetchJson<Payload>("/api/prueba"));
        await waitFor(() => expect(result.current.cargando).toBe(false));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(() => result.current.recargar());
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
