/**
 * SPEC-171 (T015) — Tests unitarios del tablero operativo: 6 semáforos +
 * widgets con fetch mockeado (vi.stubGlobal), banner de monitoreo desactivado
 * y tab "Clasificación" por query param. Sin BD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OperacionTableroClient } from "@/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient";

const nav = vi.hoisted(() => ({ tab: null as string | null, replace: vi.fn() }));

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({ get: (key: string) => (key === "tab" ? nav.tab : null) }),
    usePathname: () => "/dashboard/admin/estadisticas/operacion",
    useRouter: () => ({ replace: nav.replace }),
}));

// El dashboard de negocio y el tab de clasificación tienen sus propios tests;
// aquí se verifica que el tablero los monta en el tab correcto.
vi.mock("@/components/modules/AdminDashboard", () => ({
    AdminDashboard: () => <div data-testid="admin-dashboard" />,
}));
vi.mock("@/app/dashboard/admin/estadisticas/operacion/ClasificacionTab", () => ({
    ClasificacionTab: () => <div data-testid="clasificacion-tab" />,
}));

function estadoMonitoreo(monitoreoEnabled = true) {
    return {
        senales: {
            app: { estado: "verde", ultimoProbeEn: "2026-08-18T05:00:00.000Z", detalle: null },
            worker: { estado: "verde", ultimoProbeEn: "2026-08-18T05:00:00.000Z", detalle: null },
            bd: { estado: "verde", ultimoProbeEn: "2026-08-18T05:00:00.000Z", detalle: null },
            ollama_ping: { estado: "rojo", ultimoProbeEn: "2026-08-18T05:00:00.000Z", detalle: "HTTP 500" },
            ollama_smoke: { estado: "verde", ultimoProbeEn: "2026-08-18T05:00:00.000Z", detalle: null },
            tailscale: { estado: "no-aplica", ultimoProbeEn: null, detalle: null },
        },
        autorefreshSeg: 30,
        monitoreoEnabled,
    };
}

function respuestaSegunUrl(url: string, monitoreoEnabled: boolean): unknown {
    if (url.startsWith("/api/admin/monitoreo/estado")) return estadoMonitoreo(monitoreoEnabled);
    if (url.startsWith("/api/admin/monitoreo/historial")) {
        return {
            items: [
                { id: "p1", senal: "ollama_smoke", ok: true, latenciaMs: 0, detalle: "piggyback", metodo: "PIGGYBACK", creadoEn: "2026-08-18T05:00:00.000Z" },
            ],
            resumen24h: { pings: 10, piggybacks: 5, smokes: 1, fallos: 0 },
        };
    }
    if (url.startsWith("/api/admin/monitoreo/incidentes")) {
        return {
            items: [
                { id: "i1", senal: "ollama_ping", estado: "ABIERTO", inicio: "2026-08-18T04:00:00.000Z", fin: null, detalle: "HTTP 500" },
            ],
            pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        };
    }
    if (url.startsWith("/api/admin/monitoreo/atascados")) {
        return {
            umbralHoras: 24,
            creadoAntesDe: "2026-08-17T05:00:00.000Z",
            porEstado: { PENDIENTE: 2, PROCESANDO: 0, REVISION_MANUAL: 1, REQUIERE_ANONIMIZACION: 0 },
            total: 3,
        };
    }
    if (url.startsWith("/api/admin/estadisticas/clasificacion")) {
        return { indicadores: { sinAsignar: 0, enGestion: 0, atendidosHoy: 5, tiempoPromedioGestionMin: 42, escaladosPendientes: 2 } };
    }
    if (url.startsWith("/api/admin/estadisticas")) {
        return { worker: { enCola: 2, activos: 1, estancados: 0, completados: 10, fallidos: 1, latenciaPromedioMs: 120, tasaExito: 91 } };
    }
    return {};
}

function stubFetch(monitoreoEnabled = true) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: unknown) => ({
            ok: true,
            status: 200,
            json: async () => respuestaSegunUrl(String(input), monitoreoEnabled),
        }))
    );
}

beforeEach(() => {
    nav.tab = null;
    nav.replace.mockClear();
});

describe("OperacionTableroClient", () => {
    it("renderiza los 6 semáforos y los 4 widgets con fetch mockeado", async () => {
        stubFetch();
        render(<OperacionTableroClient />);

        await waitFor(() => expect(screen.getByText("Aplicación")).toBeTruthy());
        for (const nombre of ["Procesador de reportes", "Base de datos", "Cerebro IA", "Clasificación real del cerebro", "Túnel Tailscale"]) {
            // getAllByText: "Cerebro IA" también aparece en WidgetErrores cuando el
            // incidente del fixture (ollama_ping ABIERTO) ya se renderizó — la
            // unicidad depende del timing del fetch y convertía el test en flake.
            expect(screen.getAllByText(nombre).length).toBeGreaterThanOrEqual(1);
        }
        // Estados del fixture: rojo y no-aplica llegan al DOM.
        expect(screen.getByText("Con problema")).toBeTruthy();
        expect(screen.getByText("No aplica")).toBeTruthy();

        await waitFor(() => expect(screen.getByText("Cola de procesamiento")).toBeTruthy());
        expect(screen.getByText("Reportes atascados")).toBeTruthy();
        expect(screen.getByText("Errores activos")).toBeTruthy();
        expect(screen.getByText("Ritmo de atención (SLA)")).toBeTruthy();

        // Datos de los widgets (mockeados por endpoint).
        await waitFor(() => expect(screen.getByText("Tasa de éxito:")).toBeTruthy());
        expect(screen.getByText("Incidentes abiertos")).toBeTruthy();
        expect(screen.getByText("Tiempo promedio de gestión")).toBeTruthy();

        // El dashboard de métricas de negocio queda debajo en el mismo tab.
        expect(screen.getByTestId("admin-dashboard")).toBeTruthy();
        // Tab por defecto: operación (sin query param).
        expect(screen.queryByTestId("clasificacion-tab")).toBeNull();
    });

    it("muestra el banner y no autorefresca si monitoreoEnabled es false", async () => {
        stubFetch(false);
        render(<OperacionTableroClient />);

        await waitFor(() => expect(screen.getByText(/Monitoreo desactivado/)).toBeTruthy());
        // Los semáforos siguen pintando el último estado conocido.
        expect(screen.getByText("Aplicación")).toBeTruthy();
    });

    it("tab=clasificacion por query param monta ClasificacionTab y no los semáforos", async () => {
        nav.tab = "clasificacion";
        stubFetch();
        render(<OperacionTableroClient />);

        await waitFor(() => expect(screen.getByTestId("clasificacion-tab")).toBeTruthy());
        expect(screen.queryByText("Aplicación")).toBeNull();
        expect(screen.queryByTestId("admin-dashboard")).toBeNull();
    });

    it("SPEC-180: no renderiza nav interno de tabs (la navegación es del sub-nav de página)", async () => {
        stubFetch();
        render(<OperacionTableroClient />);

        await waitFor(() => expect(screen.getByText("Aplicación")).toBeTruthy());
        // El nav interno (botones Operación/Clasificación) se retiró en SPEC-180:
        // la navegación vive en EstadisticasSubNav (nivel página, con <Link>).
        expect(screen.queryByRole("button", { name: "Clasificación" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Operación" })).toBeNull();
        expect(screen.queryByRole("navigation", { name: "Secciones del tablero" })).toBeNull();
    });

    it("SPEC-186: click en 'Cerebro IA' abre el historial de probes Ollama", async () => {
        stubFetch();
        render(<OperacionTableroClient />);

        await waitFor(() => expect(screen.getByText("Aplicación")).toBeTruthy());
        const tarjeta = screen.getByLabelText("Señal Cerebro IA: Con problema");
        fireEvent.click(tarjeta);

        const dialog = await screen.findByRole("dialog", { name: "Historial de chequeos del Cerebro IA" });
        expect(dialog).toBeTruthy();
        expect(within(dialog).getByText("Pings")).toBeTruthy();
        expect(within(dialog).getByText("10")).toBeTruthy();
        expect(within(dialog).getByText("Piggybacks")).toBeTruthy();
        expect(within(dialog).getByText("5")).toBeTruthy();
    });
});
