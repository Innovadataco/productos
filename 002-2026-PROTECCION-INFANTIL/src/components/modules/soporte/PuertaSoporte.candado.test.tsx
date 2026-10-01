/**
 * SPEC-752 · CANDADO de la puerta de PQR (render). Los invariantes de la FORMA:
 *  - CERO texto libre: ningún `textarea`, ningún input que no sea radio (imposibilidad
 *    estructural — el padre elige, no escribe).
 *  - CERO plazo en la UI: ni en la selección ni en la confirmación aparece «días/plazo/…»
 *    (control positivo: el título / «te responde por aquí» SÍ están, así que el árbol
 *    renderizó y la ausencia de plazo es real, no un render vacío).
 *  - Los 5 motivos de Diseño; al enviar, confirmación con «te responde por aquí» + el
 *    número de seguimiento que DEVUELVE el registro (no uno inventado).
 * jsdom, sin BD.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { PuertaSoporte } from "@/components/modules/soporte/PuertaSoporte";
import { MOTIVOS_SOPORTE, COPY_PUERTA_SOPORTE } from "@/lib/soporte/motivos-soporte";

const SIN_PLAZO = /d[ií]as|plazo|24\s*h|h[áa]biles|\bfecha\b|\bsemana/i;
const okEnviar = () => Promise.resolve({ numeroSeguimiento: "PQR-2026-ABC123" });

afterEach(() => cleanup());

describe("SPEC-752 · PuertaSoporte (render)", () => {
    it("muestra los 5 motivos de la FORMA", () => {
        render(<PuertaSoporte onEnviar={okEnviar} />);
        for (const m of MOTIVOS_SOPORTE) {
            expect(screen.getByText(m.titulo), `falta el motivo "${m.titulo}"`).toBeTruthy();
        }
    });

    it("CERO texto libre: ningún textarea y todo input es radio (5 radios)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} />);
        expect(container.querySelectorAll("textarea").length, "hay un textarea (texto libre)").toBe(0);
        const inputs = Array.from(container.querySelectorAll("input"));
        expect(inputs.length).toBe(MOTIVOS_SOPORTE.length);
        for (const el of inputs) {
            expect(el.getAttribute("type"), "hay un input que no es radio (texto libre)").toBe("radio");
        }
    });

    it("CERO plazo en la selección (control positivo: el título SÍ está)", () => {
        const { container } = render(<PuertaSoporte onEnviar={okEnviar} />);
        expect(screen.getByText(COPY_PUERTA_SOPORTE.titulo)).toBeTruthy(); // positivo
        expect(SIN_PLAZO.test(container.textContent ?? ""), "la selección menciona un plazo").toBe(false);
    });

    it("al enviar: confirmación con «te responde por aquí» + el número devuelto, y SIN plazo", async () => {
        const onEnviar = vi.fn(okEnviar);
        const { container } = render(<PuertaSoporte onEnviar={onEnviar} />);
        fireEvent.click(container.querySelector('input[value="PAGO_O_COBRO"]')!);
        fireEvent.click(screen.getByRole("button", { name: COPY_PUERTA_SOPORTE.enviar }));

        await waitFor(() => expect(screen.getByText(/te responde por aquí/)).toBeTruthy());
        expect(onEnviar).toHaveBeenCalledWith("PAGO_O_COBRO");
        expect(screen.getByText("PQR-2026-ABC123"), "no muestra el número de seguimiento").toBeTruthy();
        expect(SIN_PLAZO.test(container.textContent ?? ""), "la confirmación menciona un plazo").toBe(false);
        // Ya no hay puerta de entrada de texto: la confirmación tampoco abre campo.
        expect(container.querySelectorAll("textarea").length).toBe(0);
    });

    it("no envía sin selección (el botón arranca deshabilitado)", () => {
        const onEnviar = vi.fn(okEnviar);
        render(<PuertaSoporte onEnviar={onEnviar} />);
        const boton = screen.getByRole("button", { name: COPY_PUERTA_SOPORTE.enviar }) as HTMLButtonElement;
        expect(boton.disabled, "el botón Enviar debería arrancar deshabilitado").toBe(true);
        fireEvent.click(boton);
        expect(onEnviar).not.toHaveBeenCalled();
    });
});
