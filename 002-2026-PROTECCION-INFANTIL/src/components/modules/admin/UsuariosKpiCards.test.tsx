import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsuariosKpiCards } from "./UsuariosKpiCards";

const kpiBase = [
    { key: "padres", label: "Padres", total: 10, activos: 8, inactivos: 1, bloqueados: 1, alerta: false },
    { key: "rectores", label: "Rectores", total: 3, activos: 3, inactivos: 0, bloqueados: 0, alerta: false },
    { key: "operadores", label: "Operadores", total: 5, activos: 4, inactivos: 1, bloqueados: 0, alerta: true },
    { key: "comite", label: "Comité", total: 2, activos: 2, inactivos: 0, bloqueados: 0, alerta: false },
    { key: "admins", label: "Admins", total: 1, activos: 1, inactivos: 0, bloqueados: 0, alerta: false },
] as const;

describe("UsuariosKpiCards", () => {
    it("renderiza 5 tarjetas con totales", () => {
        render(<UsuariosKpiCards kpi={[...kpiBase]} alertas={[]} />);
        expect(screen.getByText("Padres")).toBeTruthy();
        expect(screen.getByText("10")).toBeTruthy();
        expect(screen.getByText("8 activos")).toBeTruthy();
        expect(screen.getByText("1 bloqueados")).toBeTruthy();
    });

    it("muestra alertas visuales", () => {
        render(<UsuariosKpiCards kpi={[...kpiBase]} alertas={[{ tipo: "operadores_sobrecargados", mensaje: "Operadores al cupo", severidad: "danger" }]} />);
        expect(screen.getByRole("alert").textContent).toBe("Operadores al cupo");
        expect(screen.getByText("1 alerta")).toBeTruthy();
    });
});
