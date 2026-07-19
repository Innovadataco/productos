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
    nivelRiesgo: "MEDIO" as const,
    confianzaPromedio: 0.82,
    totalReportes: 1,
    reportesAutenticados: 0,
    reportesAnonimos: 1,
    ultimoReporte: "2026-07-16T15:55:26.045Z",
    plataformas: [{ id: "p1", nombre: "Facebook", clave: "facebook", total: 1, otraPlataforma: null }],
    resumenPlataformas: "1 reporte en Facebook",
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

    it("renderiza nivel de riesgo, confianza, cantidad y fecha cuando hay reportes", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Riesgo medio");
            expect(document.body.textContent).toContain("82%");
            expect(document.body.textContent).toContain("Total reportes");
            expect(document.body.textContent).toContain("Último reporte");
            expect(document.body.textContent).toContain("1 reporte en Facebook");
        });
    });

    it("no muestra contenido de reportes, mapa ni ubicaciones al anónimo", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Ubicaciones");
            expect(document.body.textContent).not.toContain("Reportes por mes");
            expect(document.body.textContent).not.toContain("Plataformas");
            expect(document.body.textContent).not.toContain("Cochabamba");
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
            expect(document.body.textContent).toContain("detalle completo");
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
            expect(document.body.textContent).toContain("Ver detalle completo");
            expect(document.body.textContent).not.toContain("Crear una cuenta");
        });

        fireEvent.click(screen.getByRole("button", { name: /Ver detalle completo/i }));
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
