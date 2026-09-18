/**
 * CANDADO · SPEC-715 (FORMA §4) · la cita confirmada del padre ofrece acciones REALES.
 *
 * El bug de Jelkin: como padre veía la cita confirmada y «no hacía nada» — solo el
 * contacto del profesional, sin cómo abrir/compartir el caso. Conductas que no se
 * pueden fingir (render real):
 *  1. CONFIRMADA con caso ligado → «Compartir el caso» + el pase (GenerarPase) +
 *     «Agregar a mi calendario».
 *  2. CONFIRMADA sin caso ligado → «elige desde cuál caso compartir» (sin pase) +
 *     «Agregar a mi calendario». (No se inventa un caso.)
 *  3. Control positivo / por remoción: en PAGADA_PENDIENTE NO aparece NINGUNO de los
 *     bloques (ni pase, ni calendario, ni pedir otra) — nada antes de CONFIRMADA.
 *  4. CUMPLIDA → «Pedir otra cita».
 *  5. La pantalla NO promete lo que no existe: nada de «recordatorio», «encuesta» ni
 *     «cerrar con código» (no se pinta un botón sin motor).
 *  6. «Agregar a mi calendario» genera de verdad un .ics (crea un blob en el cliente).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";

// El pase se prueba en su propio candado; acá se aísla para verificar que el panel lo MONTA.
vi.mock("@/components/modules/padre/GenerarPase", () => ({
    GenerarPase: ({ expedienteId }: { expedienteId: string }) => (
        <div data-testid="generar-pase">{expedienteId}</div>
    ),
}));

import { EsperaCitaPanel } from "./EsperaCitaPanel";

function cita(over: Partial<CitaParaPadreDto> = {}): CitaParaPadreDto {
    return {
        id: "c1",
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: new Date().toISOString(),
        venceEn: new Date(Date.now() + 48 * 3600_000).toISOString(),
        pagoAprobadoEn: new Date().toISOString(),
        montoTotal: 80_000,
        profesional: { id: "p1", nombreVisible: "Dra. Ramírez", tituloProfesional: "Psicología", ciudad: { id: "co", nombre: "Bogotá" } },
        franja: { inicio: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(), fin: new Date(Date.now() + 3 * 24 * 3600_000 + 3600_000).toISOString(), modalidad: "VIRTUAL" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: "exp1",
        ...over,
    };
}

afterEach(() => cleanup());

describe("SPEC-715 §4 · la cita confirmada tiene acciones reales", () => {
    it("CONFIRMADA con caso ligado: «Compartir el caso» + el pase + «Agregar a mi calendario»", () => {
        render(<EsperaCitaPanel citaInicial={cita({ expedienteCompartidoId: "exp1" })} />);
        expect(screen.getByText(/Compartir el caso/)).toBeTruthy();
        expect(screen.getByTestId("generar-pase").textContent).toBe("exp1");
        expect(screen.getByRole("button", { name: /Agregar a mi calendario/ })).toBeTruthy();
    });

    it("CONFIRMADA sin caso ligado: ofrece «elige desde cuál caso compartir», sin pase inventado", () => {
        render(<EsperaCitaPanel citaInicial={cita({ expedienteCompartidoId: null })} />);
        expect(screen.getByText(/elige desde cuál caso compartir/)).toBeTruthy();
        expect(screen.queryByTestId("generar-pase")).toBeNull();
        expect(screen.getByRole("button", { name: /Agregar a mi calendario/ })).toBeTruthy();
    });

    it("PAGADA_PENDIENTE: NINGÚN bloque de acción (control positivo — nada antes de CONFIRMADA)", () => {
        render(<EsperaCitaPanel citaInicial={cita({ estado: "PAGADA_PENDIENTE" })} />);
        expect(screen.queryByText(/Compartir el caso/)).toBeNull();
        expect(screen.queryByTestId("generar-pase")).toBeNull();
        expect(screen.queryByRole("button", { name: /Agregar a mi calendario/ })).toBeNull();
        expect(screen.queryByRole("link", { name: /Pedir otra cita/ })).toBeNull();
    });

    it("CUMPLIDA: ofrece «Pedir otra cita»", () => {
        render(<EsperaCitaPanel citaInicial={cita({ estado: "CUMPLIDA" })} />);
        expect(screen.getByRole("link", { name: /Pedir otra cita/ })).toBeTruthy();
    });

    it("no promete lo que no existe: sin «recordatorio», «encuesta» ni «cerrar con código»", () => {
        const { container } = render(<EsperaCitaPanel citaInicial={cita()} />);
        const txt = (container.textContent ?? "").toLowerCase();
        expect(txt).not.toContain("recordatorio");
        expect(txt).not.toContain("encuesta");
        expect(txt).not.toContain("cerrar con código");
        expect(txt).not.toContain("cerrar con codigo");
    });

    it("«Agregar a mi calendario» genera un .ics de verdad (crea un blob en el cliente)", () => {
        const crear = vi.fn(() => "blob:x");
        const revocar = vi.fn();
        vi.stubGlobal("URL", { ...URL, createObjectURL: crear, revokeObjectURL: revocar });
        // jsdom no navega a un `blob:` (el <a download>); silenciamos el click del enlace de
        // descarga — lo que importa es que el .ics se ARMÓ (createObjectURL), no la navegación.
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        try {
            render(<EsperaCitaPanel citaInicial={cita()} />);
            fireEvent.click(screen.getByRole("button", { name: /Agregar a mi calendario/ }));
            expect(crear).toHaveBeenCalledTimes(1);
        } finally {
            clickSpy.mockRestore();
            vi.unstubAllGlobals();
        }
    });
});
