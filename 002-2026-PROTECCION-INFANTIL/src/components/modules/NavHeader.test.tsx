import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NavHeader } from "./NavHeader";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => mockPathname,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/contexts/AuthContext";

function mockAuth(user: { id: string; email: string; nombre: string; rol: string } | null, isLoading = false) {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        user,
        isLoading,
        isAuthenticated: !!user,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn(),
    });
}

describe("NavHeader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPathname = "/";
    });

    it("logo va al home público aunque haya sesión de ADMIN en ruta pública (SPEC-106)", () => {
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<NavHeader />);
        const logo = screen.getByText("Infantil").closest("a");
        expect(logo?.getAttribute("href")).toBe("/");
    });

    it("logo va al panel del rol desde OTRA página del área (SPEC-106); en el home del rol va al home público (I-38, nunca clic muerto)", () => {
        mockPathname = "/dashboard/admin/reportes";
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        const { unmount } = render(<NavHeader />);
        let logo = screen.getByText("Infantil").closest("a");
        expect(logo?.getAttribute("href")).toBe("/dashboard/admin");
        unmount();

        mockPathname = "/dashboard/admin";
        render(<NavHeader />);
        logo = screen.getByText("Infantil").closest("a");
        expect(logo?.getAttribute("href")).toBe("/");
    });

    // SPEC-317: home de PARENT es /dashboard/padre (zona canónica).
    it("botón Dashboard apunta a /dashboard/padre para padre autenticado", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const dashboard = screen.getByText("Dashboard").closest("a");
        expect(dashboard?.getAttribute("href")).toBe("/dashboard/padre");
    });

    it("botón Dashboard apunta a /dashboard-publico para anónimos", () => {
        mockAuth(null);
        render(<NavHeader />);
        const dashboard = screen.getByText("Dashboard").closest("a");
        expect(dashboard?.getAttribute("href")).toBe("/dashboard-publico");
    });

    it("SCHOOL_ADMIN NO ve las entradas del área de padres en el menú (I-36)", () => {
        mockAuth({ id: "2", email: "colegio@test.com", nombre: "Colegio", rol: "SCHOOL_ADMIN" });
        render(<NavHeader />);
        const toggle = screen.getByText("Colegio").closest("button");
        if (toggle) fireEvent.click(toggle);
        expect(screen.queryByText("Círculo de Confianza")).toBeNull();
        expect(screen.queryByText("Mis reportes")).toBeNull();
    });

    // SPEC-317: rutas de PARENT actualizadas a zona canónica /dashboard/padre/*.
    it("PARENT sí ve las entradas de su área en el menú (I-36)", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const toggle = screen.getByText("Padre").closest("button");
        if (toggle) fireEvent.click(toggle);
        expect(screen.getByText("Círculo de Confianza").closest("a")?.getAttribute("href")).toBe("/dashboard/padre/circulo-confianza");
        expect(screen.getByText("Mis reportes").closest("a")?.getAttribute("href")).toBe("/mis-reportes");
    });

    // SPEC-317: "Mi panel" apunta a /dashboard/padre (zona canónica del padre).
    it("menú desplegable de padre muestra enlace a Mi panel en /dashboard/padre", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const toggle = screen.getByText("Padre").closest("button");
        if (toggle) fireEvent.click(toggle);
        const link = screen.getByText("Mi panel").closest("a");
        expect(link?.getAttribute("href")).toBe("/dashboard/padre");
    });

    // SPEC-118 (D-37, decisión ZEUS): ningún elemento de navegación ofrece un
    // destino que el proxy bloquea o que es la página actual — para TODOS los roles.
    it("D-37: el botón Dashboard NO se ofrece al colegio estando en /dashboard/colegio (clic muerto puro)", () => {
        mockPathname = "/dashboard/colegio";
        mockAuth({ id: "2", email: "colegio@test.com", nombre: "Colegio", rol: "SCHOOL_ADMIN" });
        render(<NavHeader />);
        expect(screen.queryByText("Dashboard")).toBeNull();
    });

    it("D-37: el botón Dashboard SÍ se ofrece al colegio fuera de su panel (destino vivo)", () => {
        mockPathname = "/dashboard-publico";
        mockAuth({ id: "2", email: "colegio@test.com", nombre: "Colegio", rol: "SCHOOL_ADMIN" });
        render(<NavHeader />);
        const dashboard = screen.getByText("Dashboard").closest("a");
        expect(dashboard?.getAttribute("href")).toBe("/dashboard/colegio");
    });

    // SPEC-317: home de PARENT es /dashboard/padre; el Dashboard es clic muerto solo ahí.
    it("D-37: el botón Dashboard NO se ofrece al padre estando en /dashboard/padre", () => {
        mockPathname = "/dashboard/padre";
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        expect(screen.queryByText("Dashboard")).toBeNull();
    });

    it("D-37: el botón Dashboard NO se ofrece al anónimo estando en /dashboard-publico", () => {
        mockPathname = "/dashboard-publico";
        mockAuth(null);
        render(<NavHeader />);
        expect(screen.queryByText("Dashboard")).toBeNull();
    });

    it("D-37: el menú de usuario no ofrece la página actual (Mi colegio abierto en /dashboard/colegio)", () => {
        mockPathname = "/dashboard/colegio";
        mockAuth({ id: "2", email: "colegio@test.com", nombre: "Colegio", rol: "SCHOOL_ADMIN" });
        const { unmount } = render(<NavHeader />);
        const toggle = screen.getByText("Colegio").closest("button");
        if (toggle) fireEvent.click(toggle);
        expect(screen.queryByText("Mi colegio")).toBeNull();
        unmount();

        // ...pero sí lo ofrece fuera de esa página
        mockPathname = "/dashboard-publico";
        render(<NavHeader />);
        const toggle2 = screen.getByText("Colegio").closest("button");
        if (toggle2) fireEvent.click(toggle2);
        expect(screen.getByText("Mi colegio").closest("a")?.getAttribute("href")).toBe("/dashboard/colegio");
    });

    // ── SPEC-340 (A-68 §5 · T034): el ámbar del escudo ──────────────────────
    describe("SPEC-340 · el escudo en ámbar", () => {
        function mockResumen(noLeidas: number) {
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => new Response(JSON.stringify({ noLeidas }), { status: 200 }))
            );
        }

        it("padre con alertas sin ver → el Guardián en alerta (ámbar)", async () => {
            mockResumen(2);
            mockAuth({ id: "p1", email: "p@x.co", nombre: "Padre", rol: "PARENT" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="alerta"]')).not.toBeNull();
            });
        });

        it("padre sin alertas → calma", async () => {
            mockResumen(0);
            mockAuth({ id: "p1", email: "p@x.co", nombre: "Padre", rol: "PARENT" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="calma"]')).not.toBeNull();
            });
            expect(container.querySelector('[data-estado="alerta"]')).toBeNull();
        });

        it("un rol que no es padre NI consulta el resumen: escudo en calma", async () => {
            const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
            vi.stubGlobal("fetch", fetchMock);
            mockAuth({ id: "a1", email: "a@x.co", nombre: "Admin", rol: "ADMIN" });
            const { container } = render(<NavHeader />);
            await waitFor(() => {
                expect(container.querySelector('[data-estado="calma"]')).not.toBeNull();
            });
            expect(fetchMock).not.toHaveBeenCalledWith("/api/notificaciones/resumen", expect.anything());
        });
    });
});
