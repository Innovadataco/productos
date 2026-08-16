/**
 * SPEC-158 (T004, US1) — EmbudoEstado: cuatro cifras del embudo sin solapes,
 * "te esperan a ti" destacado con enlace a los avisos cuando hay pendientes y
 * copy positivo cuando no hay nada (la calma también se muestra).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmbudoEstado } from "./EmbudoEstado";

describe("EmbudoEstado", () => {
    it("muestra las cuatro cifras del embudo", () => {
        render(<EmbudoEstado embudo={{ recibidos: 5, cerrados: 2, enRevision: 1, teEsperan: 2 }} />);
        const seccion = screen.getByRole("region", { name: "Embudo de estado de los reportes" });
        expect(seccion.textContent).toContain("Recibidos");
        expect(seccion.textContent).toContain("Cerrados");
        expect(seccion.textContent).toContain("En revisión");
        expect(seccion.textContent).toContain("Te esperan a ti");
        expect(seccion.textContent).toContain("5");
    });

    it("con pendientes: destaca rubí y termina en verbo (enlace a los avisos)", () => {
        render(<EmbudoEstado embudo={{ recibidos: 5, cerrados: 2, enRevision: 1, teEsperan: 2 }} />);
        const enlace = screen.getByRole("link", { name: /Ver avisos nuevos/ });
        expect(enlace.getAttribute("href")).toBe("/dashboard/colegio/alertas");
        expect(enlace.className).toContain("min-h-12"); // tap target ≥ 48px
        expect(document.querySelector('[data-estado-esperan="pendiente"]')).toBeTruthy();
    });

    it("sin pendientes: copy positivo y sin enlace de acción", () => {
        render(<EmbudoEstado embudo={{ recibidos: 3, cerrados: 2, enRevision: 1, teEsperan: 0 }} />);
        expect(screen.getByText(/Nada te espera — la vigilancia sigue activa/)).toBeTruthy();
        expect(screen.queryByRole("link", { name: /Ver avisos nuevos/ })).toBeNull();
        expect(document.querySelector('[data-estado-esperan="al-dia"]')).toBeTruthy();
    });

    it("todo en cero: ceros honestos con copy positivo, nunca pantalla rota", () => {
        render(<EmbudoEstado embudo={{ recibidos: 0, cerrados: 0, enRevision: 0, teEsperan: 0 }} />);
        expect(screen.getByText(/Nada te espera/)).toBeTruthy();
    });
});
