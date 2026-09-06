import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PublicDashboard } from "./PublicDashboard";

const mapaProps = vi.hoisted(() => ({ ultima: null as null | { sinUbicacion?: number } }));

vi.mock("./MapaUbicaciones", () => ({
    MapaUbicaciones: (props: { sinUbicacion?: number }) => {
        mapaProps.ultima = props;
        return <div data-testid="mapa" />;
    },
}));

// Shape real de la API tras D-10: sin nivel de riesgo ni score promedio.
const statsApi = {
    totales: {
        reportes: 12,
        identificadoresUnicos: 5,
        reportesAutenticados: 7,
        reportesAnonimos: 5,
    },
    porPlataforma: [{ plataforma: "WhatsApp", count: 8 }],
    porPais: [{ pais: "Colombia", count: 10 }],
    porCiudad: [{ ciudad: "Bogotá", pais: "Colombia", count: 6, lat: 4.711, lng: -74.072 }],
    porCategoria: [{ categoria: "CONTACTO_INSISTENTE", count: 4 }],
    porGrupoCategoria: [{ clave: "contacto", nombre: "Contacto sexual", orden: 1, total: 4 }],
};

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("PublicDashboard", () => {
    it("renderiza con el shape real de la API (sin nivel de riesgo) sin crash", async () => {
        mockFetch(statsApi);
        render(<PublicDashboard />);

        await waitFor(() => expect(screen.getByText("Lo que estamos viendo entre todos")).toBeTruthy());
        expect(screen.getByText("Reportes registrados")).toBeTruthy();
        expect(screen.getByText("Cuentas visibles")).toBeTruthy();
        expect(screen.queryByText(/nivel de riesgo/i)).toBeNull();
        expect(screen.queryByText(/score/i)).toBeNull();
    });

    it("no truena si la API omite campos (render defensivo)", async () => {
        mockFetch({
            totales: { reportes: 0, identificadoresUnicos: 0, reportesAutenticados: 0, reportesAnonimos: 0 },
        });
        render(<PublicDashboard />);

        await waitFor(() => expect(screen.getByText("Lo que estamos viendo entre todos")).toBeTruthy());
        expect(screen.getByText("Sin datos geográficos")).toBeTruthy();
    });

    it("muestra estado de error controlado si la API falla", async () => {
        mockFetch({}, false);
        render(<PublicDashboard />);

        await waitFor(() => expect(screen.getByText("No pudimos cargar las estadísticas")).toBeTruthy());
    });

    it("SPEC-115: pasa al mapa el conteo de reportes sin ubicación (degradación honesta)", async () => {
        mockFetch({ ...statsApi, sinUbicacion: 3 });
        render(<PublicDashboard />);

        await waitFor(() => expect(screen.getByText("Lo que estamos viendo entre todos")).toBeTruthy());
        await waitFor(() => expect(mapaProps.ultima?.sinUbicacion).toBe(3));
    });
});
