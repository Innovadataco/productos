import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginErrorPage from "@/app/login-error/page";

async function renderPage(reason?: string) {
    const searchParams = Promise.resolve(reason ? { reason } : {});
    const jsx = await LoginErrorPage({ searchParams });
    render(jsx);
}

describe("LoginErrorPage", () => {
    it("sin ?reason → mensaje genérico 'No se pudo completar el ingreso.'", async () => {
        await renderPage();
        const p = screen.getByTestId("login-error-reason");
        expect(p.textContent).toContain("No se pudo completar el ingreso");
    });

    it("?reason=expired → mensaje 'El enlace de acceso caducó.'", async () => {
        await renderPage("expired");
        const p = screen.getByTestId("login-error-reason");
        expect(p.textContent).toContain("caducó");
    });
});
