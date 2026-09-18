/**
 * CANDADO · SPEC-712 (FORMA-SPEC712 §6) · «Citaciones» muestra el ESTADO, no la regla.
 *
 * El bug de Jelkin (medido): pulsó «No puedo» en una solicitud SIN_CONFIRMAR y
 * saltó la regla del motor «Solo se puede rechazar una solicitud pagada y
 * pendiente» (409). Causa: `SolicitudAcciones` recibía solo `solicitudId` y
 * pintaba los dos botones SIEMPRE.
 *
 * Conductas que no se pueden fingir:
 *  1. SIN_CONFIRMAR → SIN botones (ni Confirmar ni No puedo) + insignia neutra
 *     «En validación» + la línea de qué va. Control positivo (§6): los botones
 *     NO se renderizan en un estado donde su acción daría 409.
 *  2. PAGADA_PENDIENTE → los DOS botones + la línea «El pago está aprobado…».
 *     Control por remoción: el mismo botón que falta en (1) aparece acá — el gate
 *     discrimina por estado, no está escondido siempre (si no, (1) sería un falso
 *     verde tan bueno con un componente que nunca pinta nada).
 *  3. Un 409 (carrera con el worker/admin) se traduce a un mensaje de ESTADO,
 *     NUNCA la regla cruda del servidor.
 *  4. Un error que NO es 409 sí surfacea la causa del servidor (no se traga todo).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// El componente llama `useRouter().refresh()`; sin App Router en jsdom hay que mockearlo.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SolicitudAcciones } from "./SolicitudAcciones";

/** La regla cruda que el motor devuelve en el 409 — la que NO debe ver el profesional. */
const REGLA_CRUDA = "Solo se puede rechazar una solicitud pagada y pendiente";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SPEC-712 §6 · SolicitudAcciones pinta por estado", () => {
    it("SIN_CONFIRMAR: sin botones de acción, insignia «En validación» y la línea de qué va", () => {
        render(<SolicitudAcciones estado="SIN_CONFIRMAR" solicitudId="s1" />);
        // Control positivo: ningún botón cuya acción daría 409.
        expect(screen.queryByRole("button", { name: /Confirmar/ })).toBeNull();
        expect(screen.queryByRole("button", { name: /No puedo/ })).toBeNull();
        expect(screen.getByText("En validación")).toBeTruthy();
        expect(screen.getByText(/Estamos validando su pago/)).toBeTruthy();
        expect(screen.getByText(/Por ahora no tiene que hacer nada/)).toBeTruthy();
    });

    it("PAGADA_PENDIENTE: los DOS botones + la línea del pago (control por remoción)", () => {
        render(<SolicitudAcciones estado="PAGADA_PENDIENTE" solicitudId="s1" />);
        expect(screen.getByRole("button", { name: /Confirmar/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: /No puedo/ })).toBeTruthy();
        expect(screen.getByText(/El pago está aprobado/)).toBeTruthy();
        // Aquí NO va el estado en validación.
        expect(screen.queryByText("En validación")).toBeNull();
    });

    it("un 409 (carrera) se muestra como ESTADO, nunca la regla cruda del motor", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: { message: REGLA_CRUDA } }), { status: 409 }),
        );
        render(<SolicitudAcciones estado="PAGADA_PENDIENTE" solicitudId="s1" />);
        fireEvent.click(screen.getByRole("button", { name: /No puedo/ }));
        expect(await screen.findByText(/Esta solicitud cambió de estado; recargue/)).toBeTruthy();
        // La regla cruda del servidor NO llega al profesional.
        expect(screen.queryByText(REGLA_CRUDA)).toBeNull();
    });

    it("un error que NO es 409 sí muestra la causa real del servidor (I-287)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: { message: "Permisos insuficientes" } }), { status: 403 }),
        );
        render(<SolicitudAcciones estado="PAGADA_PENDIENTE" solicitudId="s1" />);
        fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
        expect(await screen.findByText(/Permisos insuficientes/)).toBeTruthy();
    });
});
