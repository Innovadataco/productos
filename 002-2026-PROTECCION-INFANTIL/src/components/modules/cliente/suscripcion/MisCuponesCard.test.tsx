/**
 * SPEC-246 (002-PI-149): tests unitarios de MisCuponesCard.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MisCuponesCard } from "./MisCuponesCard";
import { ACENTOS } from "./util";

Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

function cuponBase(overrides: Partial<{ usos: number; vigenciaFin: Date; valor: number }> = {}) {
    const ahora = new Date();
    return {
        id: "cupon-1",
        nombre: "CUP-ABCD12",
        valor: overrides.valor ?? 20,
        vigenciaInicio: ahora,
        vigenciaFin: overrides.vigenciaFin ?? new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
        usos: overrides.usos ?? 0,
    };
}

describe("MisCuponesCard", () => {
    it("renderiza cupones vigentes con botón copiar", () => {
        render(<MisCuponesCard cupones={[cuponBase()]} acento={ACENTOS.cielo} />);

        expect(screen.getByText("Mis cupones de recompensa")).toBeDefined();
        expect(screen.getByText("CUP-ABCD12")).toBeDefined();
        expect(screen.getByText("Vigente")).toBeDefined();
        const boton = screen.getByRole("button", { name: "Copiar" }) as HTMLButtonElement;
        expect(boton.disabled).toBe(false);
    });

    it("no renderiza nada si no hay cupones", () => {
        const { container } = render(<MisCuponesCard cupones={[]} acento={ACENTOS.cielo} />);
        expect(container.firstChild).toBeNull();
    });

    it("muestra 'Usado' cuando el cupón tiene usos", () => {
        render(<MisCuponesCard cupones={[cuponBase({ usos: 1 })]} acento={ACENTOS.cielo} />);
        expect(screen.getByText("Usado")).toBeDefined();
        const boton = screen.getByRole("button", { name: "Copiar" }) as HTMLButtonElement;
        expect(boton.disabled).toBe(true);
    });

    it("muestra 'Vencido' cuando la vigencia terminó", () => {
        render(
            <MisCuponesCard
                cupones={[cuponBase({ vigenciaFin: new Date(Date.now() - 24 * 60 * 60 * 1000) })]}
                acento={ACENTOS.cielo}
            />
        );
        expect(screen.getByText("Vencido")).toBeDefined();
        const boton = screen.getByRole("button", { name: "Copiar" }) as HTMLButtonElement;
        expect(boton.disabled).toBe(true);
    });

    it("copia el código al portapapeles", async () => {
        render(<MisCuponesCard cupones={[cuponBase()]} acento={ACENTOS.cielo} />);
        const boton = screen.getByRole("button", { name: "Copiar" });
        await act(async () => {
            fireEvent.click(boton);
        });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("CUP-ABCD12");
    });
});
