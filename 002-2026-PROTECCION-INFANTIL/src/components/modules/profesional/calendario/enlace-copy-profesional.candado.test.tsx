/**
 * CANDADO de COPY · SPEC-778 §5 — la cara del PROFESIONAL en el estado PUBLICADO: «casi
 * nada». El botón «Entrar a la reunión» y NADA MÁS: cero «sala/segura/caduca/un solo uso/
 * admisión» (límite 1, pega más fuerte acá) y SIN el «no lo compartas» del padre (es el
 * clínico de su propia sesión, no una parte que reenviaría).
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PanelBloque, type PanelState } from "./Paneles";
import type { BloqueCalendario } from "@/lib/profesional/calendario/calendario.service";

afterEach(cleanup);

const PROHIBIDAS = /sala|segura|caduca|un solo uso|admit/i;

function panelPublicado(): PanelState {
    const bloque: BloqueCalendario = {
        id: "fr-1",
        fecha: "2099-01-05",
        minInicio: 600,
        minFin: 660,
        inicioISO: "2099-01-05T10:00:00Z",
        finISO: "2099-01-05T11:00:00Z",
        modalidad: "VIRTUAL",
        estado: "confirmada",
        familia: "Familia Test",
        enlace: { estado: "PUBLICADO", url: "https://v.example/abc123" },
    };
    return { tipo: "detalle", bloque };
}

describe("SPEC-778 §5 · copy del profesional en PUBLICADO — casi nada", () => {
    it("pinta el botón «Entrar a la reunión» con la url real (control positivo)", () => {
        const { container } = render(
            <PanelBloque panel={panelPublicado()} enviando={false} onCerrar={() => {}} onResponder={() => {}} />,
        );
        expect(screen.getByText("Entrar a la reunión")).toBeTruthy();
        expect(container.querySelector('a[href="https://v.example/abc123"]')).toBeTruthy();
    });

    it("CERO adjetivos del enlace (sala/segura/caduca/un solo uso/admisión)", () => {
        const { container } = render(
            <PanelBloque panel={panelPublicado()} enviando={false} onCerrar={() => {}} onResponder={() => {}} />,
        );
        expect(container.textContent ?? "").not.toMatch(PROHIBIDAS);
    });

    it("NO lleva el «no lo compartas» del padre (el profesional es el clínico de su sesión)", () => {
        const { container } = render(
            <PanelBloque panel={panelPublicado()} enviando={false} onCerrar={() => {}} onResponder={() => {}} />,
        );
        expect(container.textContent ?? "").not.toMatch(/no lo compartas/i);
    });
});
