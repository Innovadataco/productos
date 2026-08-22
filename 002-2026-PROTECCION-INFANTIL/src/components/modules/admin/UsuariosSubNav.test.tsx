import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsuariosSubNav } from "./UsuariosSubNav";

let pathname = "/dashboard/admin/usuarios";

vi.mock("next/navigation", () => ({
    usePathname: () => pathname,
}));

describe("UsuariosSubNav", () => {
    beforeEach(() => {
        pathname = "/dashboard/admin/usuarios";
    });

    it("resalta Padres solo en la ruta exacta", () => {
        render(<UsuariosSubNav />);
        const padres = screen.getByRole("link", { name: "Padres" });
        expect(padres.getAttribute("aria-current")).toBe("page");
    });

    it("resalta Rectores en sub-ruta", () => {
        pathname = "/dashboard/admin/usuarios/rectores";
        render(<UsuariosSubNav />);
        const rectores = screen.getByRole("link", { name: "Rectores" });
        expect(rectores.getAttribute("aria-current")).toBe("page");
        const padres = screen.getByRole("link", { name: "Padres" });
        expect(padres.getAttribute("aria-current")).toBeNull();
    });

    it("resalta Comité en sub-ruta", () => {
        pathname = "/dashboard/admin/usuarios/comite";
        render(<UsuariosSubNav />);
        const comite = screen.getByRole("link", { name: "Comité" });
        expect(comite.getAttribute("aria-current")).toBe("page");
    });
});
