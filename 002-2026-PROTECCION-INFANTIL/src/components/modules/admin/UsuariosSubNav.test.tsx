import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsuariosSubNav } from "./UsuariosSubNav";

vi.mock("next/navigation", () => ({
    usePathname: vi.fn(),
}));

const { usePathname } = await import("next/navigation");

describe("UsuariosSubNav", () => {
    it("renderiza 6 tabs", () => {
        vi.mocked(usePathname).mockReturnValue("/dashboard/admin/usuarios");
        render(<UsuariosSubNav />);
        expect(screen.getByRole("link", { name: "Padres" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Rectores" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Operadores" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Comité de convivencia" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Comité de validación" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Admins" })).toBeTruthy();
    });

    it("solo el tab Padres está activo en la raíz", () => {
        vi.mocked(usePathname).mockReturnValue("/dashboard/admin/usuarios");
        render(<UsuariosSubNav />);
        expect(screen.getByRole("link", { name: "Padres" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Rectores" }).getAttribute("aria-current")).toBeNull();
    });

    it("marca activo el tab de operadores y sus subrutas", () => {
        vi.mocked(usePathname).mockReturnValue("/dashboard/admin/usuarios/operadores/op123");
        render(<UsuariosSubNav />);
        expect(screen.getByRole("link", { name: "Operadores" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Padres" }).getAttribute("aria-current")).toBeNull();
    });
});
