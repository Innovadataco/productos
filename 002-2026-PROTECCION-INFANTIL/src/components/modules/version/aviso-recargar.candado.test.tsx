/**
 * SPEC-548 (I-337) · CANDADO caso (b): la frontera de error recarga in-situ.
 *
 * Renderiza el `error.tsx` real. Con un error de chunk (código viejo tras
 * despliegue) muestra la copia EXACTA que tranquiliza («…lo que ya estabas
 * viendo sigue aquí») y el botón cielo [Recargar la página]; con un error
 * genérico ofrece Reintentar (reset) sin mentir que «la app se actualizó».
 * CERO rubi, NUNCA modal. Muere si el detector de chunk deja de distinguir los
 * dos casos, o si reaparece el rubi/«Error»/«Sesión expirada».
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "@/app/error";

function chunkError() {
    const e = new Error("Loading chunk 12 failed.");
    e.name = "ChunkLoadError";
    return e;
}

describe("SPEC-548 · frontera de error / recargar in-situ (caso b)", () => {
    it("error de CHUNK → copia exacta del despliegue + [Recargar la página]", () => {
        render(<ErrorBoundary error={chunkError()} reset={vi.fn()} />);
        expect(
            screen.getByText("Esta parte no se pudo cargar porque la app se actualizó."),
        ).toBeTruthy();
        expect(screen.getByText(/lo que ya estabas viendo sigue aquí/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Recargar la página" })).toBeTruthy();
    });

    it("error GENÉRICO → no miente «se actualizó»; ofrece Reintentar (reset)", () => {
        const reset = vi.fn();
        render(<ErrorBoundary error={new Error("boom lógico")} reset={reset} />);
        expect(screen.queryByText(/la app se actualizó/)).toBeNull();
        expect(screen.getByText("No pudimos mostrar esta parte.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("CERO rubi, sin «Error» ni «Sesión expirada», no es modal", () => {
        const { container } = render(<ErrorBoundary error={chunkError()} reset={vi.fn()} />);
        expect(container.innerHTML).not.toContain("rubi");
        expect(container.textContent).not.toMatch(/Sesión expirada/i);
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
