import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNav } from "./AdminNav";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";

const mockPathname = vi.hoisted(() => ({ value: "/dashboard/admin" }));

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.value,
}));

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

const TODOS_MODULOS = ADMIN_NAV_ITEMS.map((i) => i.modulo);

function linksActivos() {
    return screen.getAllByRole("link").filter((a) => a.className.includes("accent-gradient"));
}

describe("AdminNav", () => {
    it("en una subruta solo se resalta esa subruta, no la raíz", () => {
        mockPathname.value = "/dashboard/admin/spam";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);

        const activos = linksActivos();
        expect(activos).toHaveLength(1);
        expect(activos[0].textContent).toContain("Revisión de spam");
    });

    it("en la raíz solo se resalta la bandeja", () => {
        mockPathname.value = "/dashboard/admin";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);

        const activos = linksActivos();
        expect(activos).toHaveLength(1);
        expect(activos[0].textContent).toContain("Bandeja de reportes");
    });

    it("resalta subrutas anidadas de un módulo que no es la raíz", () => {
        mockPathname.value = "/dashboard/admin/comite/gestion";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);

        const activos = linksActivos();
        expect(activos).toHaveLength(1);
        expect(activos[0].textContent).toContain("Comité");
    });
});
