/**
 * SPEC-181 (Tarea C): barra de filtros de la simulación anti-abuso —
 * renderiza controles, dispara el fetch con los params de la URL y publica
 * los cambios de filtro a la URL (router.push). Loading estándar <Cargando />.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminAntiAbusoSimulacion } from "./AdminAntiAbusoSimulacion";

const estado: { params: URLSearchParams; pathname: string } = {
    params: new URLSearchParams(),
    pathname: "/dashboard/admin/anti-abuso",
};

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
    usePathname: () => estado.pathname,
    useSearchParams: () => estado.params,
}));

const RESPUESTA_SIMULACION = {
    resumen: { subidas: 0, bajadas: 0, sinCambio: 0 },
    detalles: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};

function mockFetch() {
    return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        const payload = url.includes("/api/plataformas")
            ? { plataformas: [{ id: "plataforma-1", nombre: "WhatsApp" }] }
            : RESPUESTA_SIMULACION;
        return { ok: true, status: 200, json: async () => payload } as Response;
    });
}

describe("AdminAntiAbusoSimulacion (barra de filtros, SPEC-181)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        estado.params = new URLSearchParams();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza los controles de filtro y usa Cargando estándar en la carga inicial", async () => {
        mockFetch();
        render(<AdminAntiAbusoSimulacion />);

        expect(screen.getByLabelText("Buscar")).toBeTruthy();
        expect(screen.getByLabelText("Nivel de riesgo")).toBeTruthy();
        expect(screen.getByLabelText("Plataforma")).toBeTruthy();
        expect(screen.getByLabelText("Ordenar por")).toBeTruthy();
        expect(screen.getByText("Cargando simulación...")).toBeTruthy();
        // SPEC-461: el `<Cargando>` estándar es un skeleton que PULSA (antes giraba).
        // La carga inicial usa el mueble estándar, no un placeholder ad-hoc.
        expect(document.querySelector(".animate-pulse")).toBeTruthy();

        await waitFor(() => {
            expect(screen.queryByText("Cargando simulación...")).toBeNull();
        });
    });

    it("dispara el fetch con los params de la URL", async () => {
        const fetchSpy = mockFetch();
        estado.params = new URLSearchParams("q=nick&nivel=ALTO&page=2");
        render(<AdminAntiAbusoSimulacion />);

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "/api/admin/anti-abuso/simulacion-score?q=nick&nivel=ALTO&page=2",
                expect.objectContaining({ credentials: "include" })
            );
        });
    });

    it("publica el cambio de nivel a la URL volviendo a la página 1", async () => {
        mockFetch();
        render(<AdminAntiAbusoSimulacion />);

        fireEvent.change(screen.getByLabelText("Nivel de riesgo"), { target: { value: "ALTO" } });

        expect(pushMock).toHaveBeenCalledWith("/dashboard/admin/anti-abuso?page=1&nivel=ALTO");
    });

    it("publica la búsqueda con Enter y resetea la página", async () => {
        mockFetch();
        estado.params = new URLSearchParams("page=3");
        render(<AdminAntiAbusoSimulacion />);

        fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "nick123" } });
        fireEvent.keyDown(screen.getByLabelText("Buscar"), { key: "Enter" });

        expect(pushMock).toHaveBeenCalledWith("/dashboard/admin/anti-abuso?q=nick123&page=1");
    });
});
