import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
    beforeEach(() => {
        const container = document.createElement("div");
        container.setAttribute("id", "modal-root");
        document.body.appendChild(container);
    });

    afterEach(() => {
        const container = document.getElementById("modal-root");
        if (container) document.body.removeChild(container);
    });

    it("renders with role dialog and aria-modal", () => {
        render(<Modal isOpen title="Test modal" onClose={vi.fn()}>Contenido</Modal>);
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeTruthy();
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(screen.getByText("Test modal")).toBeTruthy();
    });

    it("does not render when isOpen is false", () => {
        render(<Modal isOpen={false} title="Test modal" onClose={vi.fn()}>Contenido</Modal>);
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes with Escape key", async () => {
        const onClose = vi.fn();
        render(<Modal isOpen title="Test modal" onClose={onClose}>Contenido</Modal>);
        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("closes on overlay click", async () => {
        const onClose = vi.fn();
        render(<Modal isOpen title="Test modal" onClose={onClose}>Contenido</Modal>);
        const overlay = screen.getByRole("dialog").parentElement;
        if (overlay) fireEvent.click(overlay);
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("does not close when clicking inside the panel", async () => {
        const onClose = vi.fn();
        render(<Modal isOpen title="Test modal" onClose={onClose}>Contenido</Modal>);
        const panel = screen.getByRole("dialog");
        fireEvent.click(panel);
        await waitFor(() => expect(onClose).not.toHaveBeenCalled());
    });

    it("has a visible close button with aria-label", () => {
        render(<Modal isOpen title="Test modal" onClose={vi.fn()}>Contenido</Modal>);
        const closeButton = screen.getByLabelText("Cerrar");
        expect(closeButton).toBeTruthy();
        expect(closeButton.tagName).toBe("BUTTON");
    });

    it("focuses the first focusable element on open", async () => {
        render(
            <Modal isOpen title="Test modal" onClose={vi.fn()}>
                <button type="button">First</button>
                <button type="button">Second</button>
            </Modal>
        );
        const closeButton = screen.getByLabelText("Cerrar");
        await waitFor(() => expect(document.activeElement).toBe(closeButton));
    });

    it("traps focus and cycles within the modal", async () => {
        render(
            <Modal isOpen title="Test modal" onClose={vi.fn()}>
                <button type="button">First</button>
                <button type="button">Second</button>
            </Modal>
        );
        const first = screen.getByText("First");
        const second = screen.getByText("Second");
        const closeButton = screen.getByLabelText("Cerrar");

        (closeButton as HTMLElement).focus();
        fireEvent.keyDown(document, { key: "Tab" });
        await waitFor(() => expect(document.activeElement).toBe(first));

        (first as HTMLElement).focus();
        fireEvent.keyDown(document, { key: "Tab" });
        await waitFor(() => expect(document.activeElement).toBe(second));

        (second as HTMLElement).focus();
        fireEvent.keyDown(document, { key: "Tab" });
        await waitFor(() => expect(document.activeElement).toBe(closeButton));
    });

    it("wraps focus from last to first and first to last", async () => {
        render(
            <Modal isOpen title="Test modal" onClose={vi.fn()}>
                <button type="button">First</button>
                <button type="button">Second</button>
            </Modal>
        );
        const first = screen.getByText("First");
        const closeButton = screen.getByLabelText("Cerrar");

        (closeButton as HTMLElement).focus();
        fireEvent.keyDown(document, { key: "Tab" });
        await waitFor(() => expect(document.activeElement).toBe(first));

        (first as HTMLElement).focus();
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        await waitFor(() => expect(document.activeElement).toBe(closeButton));
    });

    it("restores focus to the element that opened the modal", async () => {
        const openButton = document.createElement("button");
        openButton.setAttribute("type", "button");
        document.body.appendChild(openButton);
        openButton.focus();

        const onClose = vi.fn();
        const { rerender } = render(<Modal isOpen title="Test modal" onClose={onClose}>Contenido</Modal>);
        rerender(<Modal isOpen={false} title="Test modal" onClose={onClose}>Contenido</Modal>);
        await waitFor(() => expect(document.activeElement).toBe(openButton));
        document.body.removeChild(openButton);
    });

    it("keeps focus on the panel when no interactive elements are present", async () => {
        render(<Modal isOpen title="Test modal" showCloseButton={false} onClose={vi.fn()}>Contenido sin botones</Modal>);
        const dialog = screen.getByRole("dialog");
        await waitFor(() => expect(document.activeElement).toBe(dialog));
    });
});
