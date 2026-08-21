/**
 * SPEC-179 (I-59) / SPEC-193 Fase 4 — Sub-nav del área Estadísticas del admin:
 * 4 destinos (Operación · Clasificación ?tab= · Logs ?tab= · Motor), activo por pathname+searchParams.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadisticasSubNav } from "./EstadisticasSubNav";

const estado = vi.hoisted(() => ({ pathname: "/dashboard/admin/estadisticas/operacion", tab: null as string | null }));

vi.mock("next/navigation", () => ({
    usePathname: () => estado.pathname,
    useSearchParams: () => ({ get: (k: string) => (k === "tab" ? estado.tab : null) }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({ user: { rol: "ADMIN" } }),
}));

describe("EstadisticasSubNav (SPEC-179, I-59)", () => {
    beforeEach(() => {
        estado.pathname = "/dashboard/admin/estadisticas/operacion";
        estado.tab = null;
    });

    it("muestra los 4 destinos con sus hrefs exactos", () => {
        render(<EstadisticasSubNav />);
        expect(screen.getByRole("link", { name: "Operación" }).getAttribute("href")).toBe("/dashboard/admin/estadisticas/operacion");
        expect(screen.getByRole("link", { name: "Clasificación" }).getAttribute("href")).toBe("/dashboard/admin/estadisticas/operacion?tab=clasificacion");
        expect(screen.getByRole("link", { name: "Logs" }).getAttribute("href")).toBe("/dashboard/admin/estadisticas/operacion?tab=logs");
        expect(screen.getByRole("link", { name: "Motor" }).getAttribute("href")).toBe("/dashboard/admin/estadisticas/motor");
    });

    it("marca Operación activa por defecto y Clasificación cuando ?tab=clasificacion", () => {
        const { rerender } = render(<EstadisticasSubNav />);
        expect(screen.getByRole("link", { name: "Operación" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Clasificación" }).getAttribute("aria-current")).toBeNull();

        estado.tab = "clasificacion";
        rerender(<EstadisticasSubNav />);
        expect(screen.getByRole("link", { name: "Clasificación" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Operación" }).getAttribute("aria-current")).toBeNull();
    });

    it("marca Logs activo cuando ?tab=logs y los demás no", () => {
        estado.tab = "logs";
        render(<EstadisticasSubNav />);
        expect(screen.getByRole("link", { name: "Logs" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Operación" }).getAttribute("aria-current")).toBeNull();
        expect(screen.getByRole("link", { name: "Clasificación" }).getAttribute("aria-current")).toBeNull();
    });

    it("marca Motor activo en su página", () => {
        estado.pathname = "/dashboard/admin/estadisticas/motor";
        render(<EstadisticasSubNav />);
        expect(screen.getByRole("link", { name: "Motor" }).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Operación" }).getAttribute("aria-current")).toBeNull();
    });
});
