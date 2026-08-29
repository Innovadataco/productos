import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpamRevisionPanel } from "./SpamRevisionPanel";

const pushMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: pushMock }),
    usePathname: () => "/dashboard/admin/spam",
}));

function mockFetchListado() {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ reportes: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }),
    } as Response);
}

describe("SpamRevisionPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParams = new URLSearchParams();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza la barra (búsqueda, estado, orden) y consulta con la query de la URL", async () => {
        const fetchSpy = mockFetchListado();
        render(<SpamRevisionPanel />);

        // getBy* lanza si no existe: la barra está completa si estas cuatro consultas pasan.
        expect(screen.getByLabelText("Buscar")).toBeTruthy();
        expect(screen.getByLabelText("Estado")).toBeTruthy();
        expect(screen.getByLabelText("Ordenar por")).toBeTruthy();
        expect(screen.getByRole("button", { name: /aplicar filtros/i })).toBeTruthy();

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining("/api/admin/spam/pendientes?"),
                expect.objectContaining({ credentials: "include" })
            );
        });
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("orden=prioridad"), expect.anything());
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("page=1"), expect.anything());
    });

    it("aplicar con búsqueda dispara fetch con q y lleva la URL a página 1", async () => {
        const fetchSpy = mockFetchListado();
        render(<SpamRevisionPanel />);

        fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "5551234" } });
        fireEvent.click(screen.getByRole("button", { name: /aplicar filtros/i }));

        expect(pushMock).toHaveBeenCalledTimes(1);
        const url = pushMock.mock.calls[0][0] as string;
        expect(url).toContain("q=5551234");
        expect(url).toContain("page=1");

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("q=5551234"), expect.anything());
        });
    });
});
