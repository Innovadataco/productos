import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
    it("renderiza label y permite escribir", () => {
        const onChange = vi.fn();
        render(<Textarea label="Motivo" value="" onChange={onChange} />);

        const textarea = screen.getByLabelText("Motivo") as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();

        fireEvent.change(textarea, { target: { value: "texto de prueba" } });
        expect(onChange).toHaveBeenCalled();
    });

    it("muestra mensaje de error", () => {
        render(<Textarea label="Motivo" value="" onChange={vi.fn()} error="Muy corto" />);
        expect(screen.getByText("Muy corto")).toBeTruthy();
    });
});
