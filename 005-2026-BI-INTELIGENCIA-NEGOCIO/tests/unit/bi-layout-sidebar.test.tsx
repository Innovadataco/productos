import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BiSideNav } from "@/components/bi/layout/BiSideNav";
import { BiAppShell } from "@/components/bi/layout/BiAppShell";

const usePathnameMock = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
    usePathname: () => usePathnameMock(),
}));

afterEach(() => {
    usePathnameMock.mockReset();
});

describe("BiSideNav", () => {
    it("renderiza las 4 secciones con label y emoji", () => {
        usePathnameMock.mockReturnValue("/dashboard");
        render(<BiSideNav />);
        expect(screen.queryByText("Home")).toBeTruthy();
        expect(screen.queryByText("Dashboards")).toBeTruthy();
        expect(screen.queryByText("Chat NL→SQL")).toBeTruthy();
        expect(screen.queryByText("Configuración")).toBeTruthy();
        expect(screen.queryByText("🏠")).toBeTruthy();
        expect(screen.queryByText("📊")).toBeTruthy();
        expect(screen.queryByText("💬")).toBeTruthy();
        expect(screen.queryByText("⚙️")).toBeTruthy();
    });

    it("marca aria-current='page' en la entrada activa según pathname (/dashboard)", () => {
        usePathnameMock.mockReturnValue("/dashboard");
        render(<BiSideNav />);
        const home = screen.getByTestId("sidenav-/dashboard");
        expect(home.getAttribute("aria-current")).toBe("page");
        expect(
            screen.getByTestId("sidenav-/chat").getAttribute("aria-current"),
        ).toBeNull();
    });

    it("activa 'Chat NL→SQL' cuando pathname es /chat", () => {
        usePathnameMock.mockReturnValue("/chat");
        render(<BiSideNav />);
        expect(
            screen.getByTestId("sidenav-/chat").getAttribute("aria-current"),
        ).toBe("page");
        expect(
            screen.getByTestId("sidenav-/dashboard").getAttribute("aria-current"),
        ).toBeNull();
    });

    it("ninguna entrada activa cuando pathname no coincide", () => {
        usePathnameMock.mockReturnValue("/otra");
        render(<BiSideNav />);
        expect(
            screen.getByTestId("sidenav-/dashboard").getAttribute("aria-current"),
        ).toBeNull();
        expect(
            screen.getByTestId("sidenav-/chat").getAttribute("aria-current"),
        ).toBeNull();
    });
});

describe("BiAppShell", () => {
    it("renderiza sidebar y main con children", () => {
        usePathnameMock.mockReturnValue("/dashboard");
        render(
            <BiAppShell>
                <p data-testid="child">contenido-x</p>
            </BiAppShell>,
        );
        expect(screen.queryByRole("navigation")).toBeTruthy();
        expect(screen.queryByTestId("bi-shell-main")).toBeTruthy();
        expect(screen.getByTestId("child").textContent).toBe("contenido-x");
    });
});
