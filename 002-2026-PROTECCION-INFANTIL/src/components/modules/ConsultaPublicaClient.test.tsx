import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsultaPublicaClient } from "./ConsultaPublicaClient";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

const mockAuth = {
    user: null as { id: string; email: string; nombre: string; rol: string } | null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
};

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => mockAuth,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function setMockUser(user: typeof mockAuth.user) {
    mockAuth.user = user;
    mockAuth.isAuthenticated = !!user;
}

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

const baseConReportes = {
    identificador: "3001111111",
    tieneReportes: true,
    actividad: "baja" as const,
    totalReportes: 1,
    reportesAutenticados: 0,
    reportesAnonimos: 1,
    ultimoReporte: "2026-07-16T15:55:26.045Z",
    plataformas: [{ id: "p1", nombre: "Facebook", clave: "facebook", total: 1, otraPlataforma: null }],
    resumenPlataformas: "1 reporte en Facebook",
    categorias: [{ categoria: "CONTACTO_INSISTENTE", total: 1 }],
    ubicaciones: [{ pais: "Colombia", total: 1 }],
    autenticado: false,
};

describe("ConsultaPublicaClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setMockUser(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra mensaje claro cuando el identificador no tiene reportes", async () => {
        mockFetch({ identificador: "30009000000", tieneReportes: false, mensaje: "Sin reportes registrados." });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "30009000000" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Sin reportes registrados");
        });
    });

    it("muestra mensaje claro cuando el identificador no existe", async () => {
        mockFetch({
            identificador: "300999999999",
            tieneReportes: false,
            mensaje: "Sin reportes registrados.",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "300999999999" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Sin reportes registrados");
        });
    });

    it("renderiza badge de actividad (sin nivel de riesgo), cantidad y fecha cuando hay reportes", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Actividad baja de reportes");
            expect(document.body.textContent).toContain("Total reportes");
            expect(document.body.textContent).toContain("Último reporte");
            expect(document.body.textContent).toContain("1 reporte en Facebook");
            expect(document.body.textContent).not.toContain("Riesgo");
        });
    });

    it("muestra las categorías como badges con su total", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Contacto insistente · 1");
        });
    });

    it("no muestra la sección de categorías cuando está vacía", async () => {
        mockFetch({ ...baseConReportes, categorias: [] });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("1 reporte en Facebook");
            expect(document.body.textContent).not.toContain("Contacto insistente");
        });
    });

    it("al anónimo muestra solo el resumen con ubicaciones por país (sin ciudad ni timeline)", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Ubicaciones con reportes");
            expect(document.body.textContent).toContain("Colombia");
            expect(document.body.textContent).not.toContain("Bogotá");
            expect(document.body.textContent).not.toContain("Reportes por mes");
            expect(document.body.textContent).not.toContain("Cochabamba");
        });
    });

    it("al autenticado muestra ubicaciones con ciudad, timeline y resumen si están presentes", async () => {
        mockFetch({
            ...baseConReportes,
            autenticado: true,
            ubicaciones: [{ pais: "Colombia", departamento: "Cundinamarca", ciudad: "Bogotá", total: 1, lat: 4.711, lng: -74.0721 }],
            timeline: [{ mes: "2026-07", total: 1 }],
            resumen: "Se han reportado 1 vez(es) entre 2026-07-16 y 2026-07-16 en 1 ciudad(es) de 1 país(es) y 1 plataforma(s).",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Bogotá, Cundinamarca, Colombia");
            expect(document.body.textContent).toContain("Reportes por mes");
            expect(document.body.textContent).toContain("2026-07");
            expect(document.body.textContent).toContain("Se han reportado 1 vez(es)");
        });
    });

    it("muestra CTA para crear cuenta cuando el usuario es anónimo", async () => {
        setMockUser(null);
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Crear una cuenta");
            expect(document.body.textContent).toContain("más detalles");
        });
    });

    it("muestra acceso al panel cuando el usuario ya está autenticado como PARENT", async () => {
        setMockUser({ id: "u1", email: "parent@example.com", nombre: "Padre", rol: "PARENT" });
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Ir a mi panel");
            expect(document.body.textContent).not.toContain("Crear una cuenta");
        });

        fireEvent.click(screen.getByRole("button", { name: /Ir a mi panel/i }));
        expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });

    it("muestra resumen multi-plataforma cuando hay varias plataformas", async () => {
        mockFetch({
            ...baseConReportes,
            totalReportes: 5,
            plataformas: [
                { id: "p1", nombre: "Roblox", clave: "roblox", total: 3, otraPlataforma: null },
                { id: "p2", nombre: "Snapchat", clave: "snapchat", total: 1, otraPlataforma: null },
                { id: "p3", nombre: "Discord", clave: "discord", total: 1, otraPlataforma: null },
            ],
            resumenPlataformas: "5 reportes en Roblox, Snapchat y Discord",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("5 reportes en Roblox, Snapchat y Discord");
        });
    });

    it("muestra el nombre personalizado cuando la plataforma es 'otro'", async () => {
        mockFetch({
            ...baseConReportes,
            plataformas: [
                { id: "p-otro", nombre: "Otra plataforma", clave: "otro", total: 1, otraPlataforma: "Telegram" },
            ],
            resumenPlataformas: "1 reporte en Telegram",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Telegram");
            expect(document.body.textContent).not.toContain("undefined");
            expect(document.body.textContent).not.toContain("Otra plataforma");
        });
    });

    it("no muestra 'undefined' cuando otraPlataforma está vacía", async () => {
        mockFetch({
            ...baseConReportes,
            plataformas: [
                { id: "p-otro", nombre: "Otra plataforma", clave: "otro", total: 1, otraPlataforma: null },
            ],
            resumenPlataformas: "1 reporte en Otra plataforma",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("undefined");
            expect(document.body.textContent).toContain("Otra plataforma");
        });
    });
});
