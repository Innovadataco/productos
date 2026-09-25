/**
 * CANDADO · SPEC-729 (§2 + §4 · Jelkin probando 24-09) · el panel «Antes de conocer
 * a alguien» deja de pedir la presentación (vive en Mi perfil) y la urgencia (control
 * inerte). Supersede SPEC-440 P5, que persistía presentación + urgencia DESDE acá.
 *
 * Conducta (render real + control por remoción):
 *  · NO hay textarea de presentación ni radios de urgencia.
 *  · Muestra los canales oficiales (brief §7) y el paso al directorio.
 *  · «Ver profesionales verificados» navega al directorio, propagando SOLO los IDs
 *    opacos (expedienteId/heredarDe), nunca PII.
 * Muere si vuelve el textarea/urgencia o si el botón deja de navegar.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PresentacionUrgenciaForm } from "./PresentacionUrgenciaForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@/components/modules/CanalesOficiales", () => ({
    CanalesOficiales: () => <div data-testid="canales" />,
}));

const HREF = "/dashboard/padre/profesionales/directorio";

beforeEach(() => pushMock.mockReset());
afterEach(() => cleanup());

describe("SPEC-729 · el panel de aterrizaje no pide presentación ni urgencia", () => {
    it("NO hay textarea de presentación ni radios de urgencia", () => {
        render(<PresentacionUrgenciaForm hrefDirectorio={HREF} />);
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByRole("radio")).toBeNull();
        expect(screen.queryByText(/Qué tan urgente/)).toBeNull();
    });

    it("muestra los canales oficiales y el paso al directorio", () => {
        render(<PresentacionUrgenciaForm hrefDirectorio={HREF} />);
        expect(screen.getByTestId("canales")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Ver profesionales verificados/i })).toBeTruthy();
    });

    it("«Ver profesionales» navega al directorio (sin IDs → sin query)", () => {
        render(<PresentacionUrgenciaForm hrefDirectorio={HREF} />);
        fireEvent.click(screen.getByRole("button", { name: /Ver profesionales verificados/i }));
        expect(pushMock).toHaveBeenCalledWith(HREF);
    });

    it("propaga SOLO los IDs opacos por query (expedienteId/heredarDe), nunca PII", () => {
        render(
            <PresentacionUrgenciaForm hrefDirectorio={HREF} expedienteIdInicial="exp1" heredarDeInicial="cit9" />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Ver profesionales verificados/i }));
        const dest = pushMock.mock.calls[0]![0] as string;
        expect(dest.startsWith(`${HREF}?`)).toBe(true);
        expect(dest).toContain("expedienteId=exp1");
        expect(dest).toContain("heredarDe=cit9");
    });
});
