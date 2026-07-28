import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

    it("botón Dashboard apunta a /dashboard para padre autenticado", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const dashboard = screen.getByText("Dashboard").closest("a");
        expect(dashboard?.getAttribute("href")).toBe("/dashboard");
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

    it("PARENT sí ve las entradas de su área en el menú (I-36)", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const toggle = screen.getByText("Padre").closest("button");
        if (toggle) fireEvent.click(toggle);
        expect(screen.getByText("Círculo de Confianza").closest("a")?.getAttribute("href")).toBe("/dashboard/circulo-confianza");
        expect(screen.getByText("Mis reportes").closest("a")?.getAttribute("href")).toBe("/mis-reportes");
    });

    it("menú desplegable de padre muestra enlace a Mi panel", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const toggle = screen.getByText("Padre").closest("button");
        if (toggle) fireEvent.click(toggle);
        const link = screen.getByText("Mi panel").closest("a");
        expect(link?.getAttribute("href")).toBe("/dashboard");
    });
});
