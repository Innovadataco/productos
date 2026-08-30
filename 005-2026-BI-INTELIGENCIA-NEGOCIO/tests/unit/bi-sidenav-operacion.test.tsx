import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BiSideNav } from "@/components/bi/layout/BiSideNav";

const usePathnameMock = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
    usePathname: () => usePathnameMock(),
}));

afterEach(() => usePathnameMock.mockReset());

describe("BiSideNav · entrada Operación (SPEC-034)", () => {
    it("existe una entrada con href /operacion y label 'Operación', y es la primera", () => {
        usePathnameMock.mockReturnValue("/operacion");
        render(<BiSideNav />);
        const op = screen.getByTestId("sidenav-/operacion");
        expect(op).toBeTruthy();
        expect(op.textContent).toContain("Operación");
        expect(op.getAttribute("href")).toBe("/operacion");

        // Es la primera entrada del menú (antes que Home).
        const links = screen.getAllByRole("link");
        expect(links[0].getAttribute("href")).toBe("/operacion");
    });

    it("marca aria-current='page' cuando pathname es /operacion", () => {
        usePathnameMock.mockReturnValue("/operacion");
        render(<BiSideNav />);
        expect(
            screen.getByTestId("sidenav-/operacion").getAttribute("aria-current"),
        ).toBe("page");
        // Home no está activa.
        expect(
            screen.getByTestId("sidenav-/dashboard").getAttribute("aria-current"),
        ).toBeNull();
    });

    it("el destino es real: src/app/operacion/page.tsx existe (no lleva a un 404)", () => {
        const destino = join(process.cwd(), "src/app/operacion/page.tsx");
        expect(existsSync(destino)).toBe(true);
    });
});
