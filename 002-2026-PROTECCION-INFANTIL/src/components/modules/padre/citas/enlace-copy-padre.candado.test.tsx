/**
 * CANDADO de COPY · SPEC-778 — la cara del PADRE en el estado PUBLICADO del enlace NO
 * promete propiedades del enlace que el sistema no controla (FORMA §1-3, límite 1).
 *
 * Render real + control positivo (el estado PUBLICADO SÍ se pinta con su botón, para que
 * «cero palabras prohibidas» no sea vacío): busca en el texto visible «sala/segura/caduca/
 * un solo uso/admisión» y exige CERO. El «no lo compartas» del padre SÍ está (indicación,
 * no garantía). La `url` va en el href (acceso a la sesión de un menor), no en el texto.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EsperaCitaPanel } from "./EsperaCitaPanel";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";

afterEach(cleanup);

// Franja en el FUTURO para que la cita esté «viva» (confirmadaViva) y se pinte el enlace.
const INI = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
const FIN = new Date(Date.now() + 3 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
const PROHIBIDAS = /sala|segura|caduca|un solo uso|admit/i;

function citaPublicada(): CitaParaPadreDto {
    return {
        id: "sol-1",
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: new Date().toISOString(),
        venceEn: FIN,
        pagoAprobadoEn: new Date().toISOString(),
        montoTotal: 110_000,
        profesional: {
            id: "p1",
            nombreVisible: "Dra. Test",
            tituloProfesional: "Psicóloga",
            ciudad: { id: "c1", nombre: "Bogotá" },
        },
        franja: { inicio: INI, fin: FIN, modalidad: "VIRTUAL" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: null,
        enlace: { estado: "PUBLICADO", url: "https://v.example/abc123" },
    };
}

describe("SPEC-778 · copy del padre en PUBLICADO — sin adjetivos que no controlamos", () => {
    it("pinta el botón «Entrar a la reunión» (control positivo)", () => {
        const { container } = render(<EsperaCitaPanel citaInicial={citaPublicada()} />);
        expect(screen.getByText("Entrar a la reunión")).toBeTruthy();
        // el href lleva la url real (acceso a la sesión); es un enlace, escapado por React.
        const enlace = container.querySelector('a[href="https://v.example/abc123"]');
        expect(enlace, "el botón debe apuntar a la url real").toBeTruthy();
    });

    it("dice «no lo compartas» (indicación al padre, no garantía del sistema)", () => {
        render(<EsperaCitaPanel citaInicial={citaPublicada()} />);
        expect(screen.getByText(/no lo compartas/i)).toBeTruthy();
    });

    it("CERO adjetivos del enlace en el texto visible (sala/segura/caduca/un solo uso/admisión)", () => {
        const { container } = render(<EsperaCitaPanel citaInicial={citaPublicada()} />);
        expect(container.textContent ?? "").not.toMatch(PROHIBIDAS);
    });
});
