import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
    it("renderiza título y descripción por defecto", () => {
        render(<ErrorState />);
        expect(screen.getByText("No pudimos cargar la información")).toBeTruthy();
        expect(screen.getByText("Ocurrió un error inesperado. Puedes intentarlo de nuevo o volver más tarde.")).toBeTruthy();
    });

    it("renderiza título y descripción personalizados", () => {
        render(<ErrorState title="Sin conexión" description="Revisa tu red." />);
        expect(screen.getByText("Sin conexión")).toBeTruthy();
        expect(screen.getByText("Revisa tu red.")).toBeTruthy();
    });

    it("llama a onRetry al presionar el botón de reintentar", () => {
        const onRetry = vi.fn();
        render(<ErrorState onRetry={onRetry} retryLabel="Intentar otra vez" />);
        const button = screen.getByRole("button", { name: "Intentar otra vez" });
        fireEvent.click(button);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("no muestra botón si no se proporciona onRetry", () => {
        render(<ErrorState />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("renderiza acción adicional cuando se proporciona", () => {
        render(<ErrorState action={<a href="/ayuda">Ir a ayuda</a>} />);
        expect(screen.getByRole("link", { name: "Ir a ayuda" })).toBeTruthy();
    });
});

