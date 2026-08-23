import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionPing } from "./useSessionPing";

describe("useSessionPing", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            writable: true,
            configurable: true,
        });
    });

    it("envía ping inmediato cuando la pestaña es visible", async () => {
        renderHook(() => useSessionPing());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
            await Promise.resolve();
        });
        expect(fetch).toHaveBeenCalledWith("/api/session/ping", {
            method: "POST",
            credentials: "include",
        });
    });

    it("no envía ping inmediato cuando la pestaña está oculta", async () => {
        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            writable: true,
            configurable: true,
        });
        renderHook(() => useSessionPing());
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
            await Promise.resolve();
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("logea error de red sin romper", async () => {
        vi.useRealTimers();
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
        renderHook(() => useSessionPing());
        await new Promise((r) => setTimeout(r, 100));
        expect(consoleSpy).toHaveBeenCalledWith("[SessionPing] Error de red:", "network down");
        consoleSpy.mockRestore();
    });

    it("logea advertencia ante respuesta de error distinta a 401", async () => {
        vi.useRealTimers();
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
        );
        renderHook(() => useSessionPing());
        await new Promise((r) => setTimeout(r, 100));
        expect(consoleSpy).toHaveBeenCalledWith("[SessionPing] Ping falló:", 500);
        consoleSpy.mockRestore();
    });

    it("ignora silenciosamente respuesta 401", async () => {
        vi.useRealTimers();
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
        );
        renderHook(() => useSessionPing());
        await new Promise((r) => setTimeout(r, 100));
        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("logea error de red no-Error sin romper", async () => {
        vi.useRealTimers();
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue("error crudo"));
        renderHook(() => useSessionPing());
        await new Promise((r) => setTimeout(r, 100));
        expect(consoleSpy).toHaveBeenCalledWith("[SessionPing] Error de red:", "Error desconocido");
        consoleSpy.mockRestore();
    });
});
