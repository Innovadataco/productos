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

    it("en la URL propia de la bandeja se resalta la bandeja (SPEC-404 · I-290)", () => {
        mockPathname.value = "/dashboard/admin/bandeja";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);

        const activos = linksActivos();
        expect(activos).toHaveLength(1);
        expect(activos[0].textContent).toContain("Bandeja de reportes");
    });

    it("en la raíz-aterrizaje `/dashboard/admin` no se resalta ningún item (SPEC-404)", () => {
        // `/dashboard/admin` es aterrizaje que redirige a Inicio o Bandeja;
        // ningún item del menú apunta ahí, así que ninguno queda activo.
        mockPathname.value = "/dashboard/admin";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);
        expect(linksActivos()).toHaveLength(0);
    });

    it("resalta subrutas anidadas de un módulo que no es la raíz", () => {
        mockPathname.value = "/dashboard/admin/comite/gestion";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);

        const activos = linksActivos();
        expect(activos).toHaveLength(1);
        expect(activos[0].textContent).toContain("Comité");
    });
});

// SPEC-502 · CANDADO: el chrome de AdminNav (marco, cabecera, pie, hover, glow del
// item activo) se pinta con tokens del Sistema de Diseño, no con color crudo
// slate/sky. Pese a SPEC-495 el marco de las 60 pantallas admin conservaba 13
// clases slate/sky (auditoría de forma 05-09, patrón #4). Este candado vigila la
// CONDUCTA: inspecciona el className REALMENTE renderizado, no la fuente. Muere con
// el defecto — revertir cualquier clase a slate/sky-NNN vuelve rojo el regex de
// familia cruda; y las aserciones positivas impiden pasar borrando el chrome.
describe("AdminNav · chrome tokenizado (SPEC-502)", () => {
    // Mismo patrón de familia cruda que scripts/tokens-check.ts (ratchet SPEC-157).
    const CRUDO =
        /\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

    function clasesRenderizadas(container: HTMLElement): string {
        return Array.from(container.querySelectorAll<HTMLElement>("[class]"))
            .map((el) => el.getAttribute("class") ?? "")
            .join(" ");
    }

    it("no renderiza NINGUNA clase de color crudo (slate/sky ni otra familia)", () => {
        // pathname sobre un item real ejercita marco + cabecera + item activo
        // (accent-gradient + glow) + items inactivos (hover) + pie + enlace de clave.
        mockPathname.value = "/dashboard/admin/spam";
        const { container } = render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);
        const clases = clasesRenderizadas(container);
        expect(clases).not.toMatch(CRUDO);
    });

    it("el marco lleva los tokens de superficie y línea (no borrarlos para pasar)", () => {
        mockPathname.value = "/dashboard/admin/spam";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);
        const nav = screen.getByRole("navigation");
        expect(nav.className).toContain("border-tinta/10");
        expect(nav.className).toContain("bg-papel/70");
        expect(nav.className).toContain("dark:bg-papel/60");
    });

    it("el glow del item activo (accent-gradient) es cielo, no sky", () => {
        mockPathname.value = "/dashboard/admin/spam";
        render(<AdminNav rol="ADMIN" modulosPermitidos={TODOS_MODULOS} />);
        const activo = linksActivos()[0];
        expect(activo.className).toContain("shadow-cielo/25");
        expect(activo.className).toContain("dark:shadow-cielo/20");
        expect(activo.className).not.toMatch(/shadow-sky-/);
    });
});
