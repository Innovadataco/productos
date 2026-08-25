import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BannerBienvenida } from "./BannerBienvenida";

describe("BannerBienvenida (SPEC-247)", () => {
    it("renderiza el mensaje de bienvenida", () => {
        render(<BannerBienvenida />);
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.getByText("¡Bienvenido a Protección Infantil!")).toBeTruthy();
    });

    it("se cierra al pulsar el botón de cerrar", () => {
        render(<BannerBienvenida />);
        const boton = screen.getByRole("button", { name: "Cerrar mensaje de bienvenida" });
        fireEvent.click(boton);
        expect(screen.queryByRole("status")).toBeNull();
    });
});
