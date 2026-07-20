import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
    it("does not render tooltip by default", () => {
        render(
            <Tooltip content="Cambiar tema">
                <button type="button">Theme</button>
            </Tooltip>
        );
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("shows tooltip on mouse enter", () => {
        render(
            <Tooltip content="Cambiar tema">
                <button type="button">Theme</button>
            </Tooltip>
        );
        const button = screen.getByText("Theme");
        fireEvent.mouseEnter(button);
        expect(screen.getByRole("tooltip").textContent).toBe("Cambiar tema");
    });

    it("hides tooltip on mouse leave", () => {
        render(
            <Tooltip content="Cambiar tema">
                <button type="button">Theme</button>
            </Tooltip>
        );
        const button = screen.getByText("Theme");
        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("shows tooltip on focus", () => {
        render(
            <Tooltip content="Cambiar tema">
                <button type="button">Theme</button>
            </Tooltip>
        );
        const button = screen.getByText("Theme");
        fireEvent.focus(button);
        expect(screen.getByRole("tooltip").textContent).toBe("Cambiar tema");
    });

    it("links tooltip to trigger with aria-describedby", () => {
        render(
            <Tooltip content="Cambiar tema">
                <button type="button" aria-label="Theme">Theme</button>
            </Tooltip>
        );
        const button = screen.getByLabelText("Theme");
        const describedBy = button.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        fireEvent.focus(button);
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip.id).toBe(describedBy);
    });
});
