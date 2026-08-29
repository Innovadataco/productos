/**
 * SPEC-305 (A-50): tests de renderizado de SemaforoItem.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemaforoItem } from "./SemaforoItem";

describe("SemaforoItem (SPEC-305)", () => {
    it("renderiza verde con 'Sin novedades'", () => {
        render(
            <SemaforoItem
                etiqueta="Hijo"
                color="VERDE"
                totalReportes={0}
                categoriaDominante={null}
                activo={true}
            />
        );

        expect(screen.getByText("Hijo")).toBeDefined();
        expect(screen.getByText("Sin novedades")).toBeDefined();
        expect(screen.getByText("Sin reportes registrados")).toBeDefined();
    });

    it("renderiza ámbar con conteo de reportes", () => {
        render(
            <SemaforoItem
                etiqueta="Sobrina"
                color="AMBAR"
                totalReportes={2}
                categoriaDominante="CONTACTO_INSISTENTE"
                activo={true}
            />
        );

        expect(screen.getByText("Sobrina")).toBeDefined();
        expect(screen.getByText("Requiere atención")).toBeDefined();
        expect(screen.getByText("2 reportes registrados")).toBeDefined();
        expect(screen.getByText(/Categoría:/)).toBeDefined();
    });

    it("renderiza rojo con categoría dominante", () => {
        render(
            <SemaforoItem
                etiqueta="Hija"
                color="ROJO"
                totalReportes={1}
                categoriaDominante="SOLICITUD_MATERIAL"
                activo={true}
            />
        );

        expect(screen.getByText("Hija")).toBeDefined();
        expect(screen.getByText("Alerta prioritaria")).toBeDefined();
    });

    it("usa 'Sin nombre' cuando la etiqueta es null", () => {
        render(
            <SemaforoItem
                etiqueta={null}
                color="VERDE"
                totalReportes={0}
                categoriaDominante={null}
                activo={true}
            />
        );

        expect(screen.getByText("Sin nombre")).toBeDefined();
    });

    it("atenua contacto inactivo", () => {
        const { container } = render(
            <SemaforoItem
                etiqueta="Inactivo"
                color="VERDE"
                totalReportes={0}
                categoriaDominante={null}
                activo={false}
            />
        );

        expect(container.querySelector(".opacity-60")).not.toBeNull();
    });
});
