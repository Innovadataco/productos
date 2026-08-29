import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperadoresTable } from "./OperadoresTable";

const items = [
    {
        id: "op1",
        email: "op1@example.com",
        nombre: "Operador Uno",
        estado: "activo",
        cupoMaximo: 10,
        casosAbiertos: 7,
        enProceso: 0,
        cerrados30Dias: 0,
        tiempoMedioResolucionMs: null,
    },
];

const pagination = { page: 1, pageSize: 25, total: 1, totalPages: 1 };

describe("OperadoresTable", () => {
    it("renderiza columnas del BRIEF y casos abiertos", () => {
        render(<OperadoresTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("Operador Uno")).toBeTruthy();
        expect(screen.getByText("op1@example.com")).toBeTruthy();
        expect(screen.getByText("7")).toBeTruthy();
        expect(screen.getByText("10")).toBeTruthy();
        expect(screen.getByText("70%")).toBeTruthy();
        const link = screen.getByRole("link", { name: "Ver detalle" });
        expect(link).toBeTruthy();
        expect(link.getAttribute("href")).toBe("/dashboard/admin/usuarios/op1");
    });
});
