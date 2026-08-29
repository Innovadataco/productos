/**
 * SPEC-305 (A-50): tests de renderizado de SemaforoCirculo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemaforoCirculo } from "./SemaforoCirculo";
import type { SemaforoContacto } from "@/lib/padre/semaforo";

describe("SemaforoCirculo (SPEC-305)", () => {
    it("muestra estado vacío cuando no hay contactos", () => {
        render(<SemaforoCirculo contactos={[]} />);

        expect(screen.getByText("Estado de tu círculo de confianza")).toBeDefined();
        expect(screen.getByText(/Aún no tienes contactos/)).toBeDefined();
    });

    it("renderiza los contactos ordenados por severidad", () => {
        const contactos: SemaforoContacto[] = [
            {
                id: "1",
                etiqueta: "Verde",
                activo: true,
                color: "VERDE",
                totalReportes: 0,
                reportes30Dias: 0,
                categoriaDominante: null,
                grupoDominante: null,
                tieneExpedienteRojo: false,
            },
            {
                id: "2",
                etiqueta: "Ambar",
                activo: true,
                color: "AMBAR",
                totalReportes: 1,
                reportes30Dias: 1,
                categoriaDominante: "CONTACTO_INSISTENTE",
                grupoDominante: "manipulacion_engano",
                tieneExpedienteRojo: false,
            },
            {
                id: "3",
                etiqueta: "Rojo",
                activo: true,
                color: "ROJO",
                totalReportes: 3,
                reportes30Dias: 3,
                categoriaDominante: "SOLICITUD_MATERIAL",
                grupoDominante: "contacto_sexual",
                tieneExpedienteRojo: false,
            },
        ];

        render(<SemaforoCirculo contactos={contactos} />);

        const tarjetas = screen.getAllByRole("link");
        expect(tarjetas).toHaveLength(3);
        expect(tarjetas[0].getAttribute("aria-label")).toBe("Rojo: Alerta prioritaria");
        expect(tarjetas[1].getAttribute("aria-label")).toBe("Ambar: Requiere atención");
        expect(tarjetas[2].getAttribute("aria-label")).toBe("Verde: Sin novedades");
    });
});
