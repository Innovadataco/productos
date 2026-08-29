import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpamFiltros } from "./SpamFiltros";

describe("SpamFiltros", () => {
    it("renderiza controles y aplica filtros", () => {
        const setQ = vi.fn();
        const setEstado = vi.fn();
        const setOrden = vi.fn();
        const onApply = vi.fn();
        const onOrdenChange = vi.fn();

        render(
            <SpamFiltros
                q=""
                setQ={setQ}
                estado=""
                setEstado={setEstado}
                orden="prioridad"
                setOrden={setOrden}
                onApply={onApply}
                onOrdenChange={onOrdenChange}
            />
        );

        expect(screen.getByLabelText("Buscar")).toBeTruthy();
        expect(screen.getByLabelText("Estado")).toBeTruthy();
        expect(screen.getByLabelText("Ordenar por")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "555" } });
        expect(setQ).toHaveBeenCalledWith("555");

        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
        expect(onApply).toHaveBeenCalled();
    });

    it("aplica filtros al presionar Enter", () => {
        const onApply = vi.fn();
        render(
            <SpamFiltros
                q=""
                setQ={vi.fn()}
                estado=""
                setEstado={vi.fn()}
                orden="prioridad"
                setOrden={vi.fn()}
                onApply={onApply}
                onOrdenChange={vi.fn()}
            />
        );

        fireEvent.keyDown(screen.getByLabelText("Buscar"), { key: "Enter" });
        expect(onApply).toHaveBeenCalled();
    });

    it("cambia estado y orden", () => {
        const setEstado = vi.fn();
        const setOrden = vi.fn();
        const onOrdenChange = vi.fn();

        render(
            <SpamFiltros
                q=""
                setQ={vi.fn()}
                estado=""
                setEstado={setEstado}
                orden="prioridad"
                setOrden={setOrden}
                onApply={vi.fn()}
                onOrdenChange={onOrdenChange}
            />
        );

        fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "POSIBLE_SPAM" } });
        expect(setEstado).toHaveBeenCalledWith("POSIBLE_SPAM");

        fireEvent.change(screen.getByLabelText("Ordenar por"), { target: { value: "recientes" } });
        expect(setOrden).toHaveBeenCalledWith("recientes");
        expect(onOrdenChange).toHaveBeenCalledWith("recientes");
    });
});
