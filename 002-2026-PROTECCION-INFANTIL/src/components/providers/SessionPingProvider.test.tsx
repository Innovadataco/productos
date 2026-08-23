import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionPingProvider } from "./SessionPingProvider";

describe("SessionPingProvider", () => {
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
    });

    it("renderiza hijos y monta el ping", async () => {
        render(
            <SessionPingProvider>
                <div data-testid="child">hijo</div>
            </SessionPingProvider>
        );
        expect(screen.getByTestId("child").textContent).toBe("hijo");
        await vi.advanceTimersByTimeAsync(0);
        expect(fetch).toHaveBeenCalledWith("/api/session/ping", {
            method: "POST",
            credentials: "include",
        });
    });
});
