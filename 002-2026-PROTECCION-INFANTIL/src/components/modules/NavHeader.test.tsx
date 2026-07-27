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

    it("logo va al panel del rol cuando el ADMIN está dentro de /dashboard/** (SPEC-106)", () => {
        mockPathname = "/dashboard/admin";
        mockAuth({ id: "1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<NavHeader />);
        const logo = screen.getByText("Infantil").closest("a");
        expect(logo?.getAttribute("href")).toBe("/dashboard/admin");
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

    it("menú desplegable de padre muestra enlace a Mi panel", () => {
        mockAuth({ id: "1", email: "padre@test.com", nombre: "Padre", rol: "PARENT" });
        render(<NavHeader />);
        const toggle = screen.getByText("Padre").closest("button");
        if (toggle) fireEvent.click(toggle);
        const link = screen.getByText("Mi panel").closest("a");
        expect(link?.getAttribute("href")).toBe("/dashboard");
    });
});
