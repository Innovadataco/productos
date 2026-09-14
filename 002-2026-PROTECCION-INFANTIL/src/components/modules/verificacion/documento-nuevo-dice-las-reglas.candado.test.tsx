/**
 * CANDADO · SPEC-693 (I-416) · La pantalla «documento nuevo» DICE las dos reglas del CEO.
 *
 * FORMA de Diseño §3: «no se cumplen escondiéndolas: se cumplen diciéndolas». Si la
 * pantalla solo dijera «Aprobado», el Verificador se iría creyendo que renovó al
 * profesional — el error que hay que hacer imposible. Este candado RENDERIZA el componente
 * y exige el texto en pantalla (conducta con dato real, no una lista de palabras):
 *   · al aceptar: «el perfil no cambia de estado» + «sigue igual» (la vigencia).
 *   · al devolver: «sigue atendiendo con el documento anterior» + «no lo saca de circulación».
 *   · al devolver: observación OBLIGATORIA (vacía no confirma) + la línea a gerencia.
 *   · nunca la palabra «renovación» (FORMA §0: es «documento nuevo»).
 *
 * Muere por mutación: si alguien reduce la confirmación a «Aprobado», o borra la frase de
 * «sigue atendiendo», o habilita devolver con la observación vacía, cae.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DocumentoNuevoClient } from "./DocumentoNuevoClient";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const DATA = {
    perfilProfesionalId: "p1",
    profesional: { nombreVisible: "Ana Ruiz", tituloProfesional: "Psicología", ciudadNombre: "Bogotá" },
    requisitoClave: "tarjeta",
    requisitoNombre: "Tarjeta profesional",
    venceEn: "2026-12-01T00:00:00Z",
    vigente: { subidoEn: "2026-01-01T00:00:00Z", aprobadoEn: "2026-01-05T00:00:00Z", aprobadoPor: "verif@x.local" },
    nuevo: { subidoEn: "2026-09-10T00:00:00Z" },
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("SPEC-693 · la pantalla dice las dos reglas y nunca «renovación»", () => {
    it("alcance en el encabezado: un documento, no la persona; insignia Atendiendo", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        expect(screen.getByText(/un documento/i)).toBeTruthy();
        expect(screen.getByText(/no a la persona/i)).toBeTruthy();
        expect(screen.getAllByText(/Atendiendo/i).length).toBeGreaterThan(0);
    });

    it("aceptar DICE: el perfil no cambia de estado y la vigencia sigue igual", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        fireEvent.click(screen.getByRole("button", { name: /Aceptar este documento/i }));
        expect(screen.getByText(/el perfil no cambia de estado/i)).toBeTruthy();
        expect(screen.getByText(/sigue igual/i)).toBeTruthy();
        // La regla se dice ANTES de confirmar (hay un paso de confirmación explícito).
        expect(screen.getByRole("button", { name: /Confirmar: aceptar/i })).toBeTruthy();
    });

    it("devolver DICE: sigue atendiendo con el anterior y no lo saca de circulación", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        fireEvent.click(screen.getByRole("button", { name: /^Devolverlo$/i }));
        expect(screen.getByText(/sigue atendiendo con el documento anterior/i)).toBeTruthy();
        expect(screen.getByText(/no lo saca de circulación/i)).toBeTruthy();
    });

    it("devolver: observación OBLIGATORIA — vacía no confirma; con texto sí", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        fireEvent.click(screen.getByRole("button", { name: /^Devolverlo$/i }));
        const confirmar = screen.getByRole("button", { name: /Confirmar: devolver/i }) as HTMLButtonElement;
        expect(confirmar.disabled, "vacía no debe poder confirmar").toBe(true);
        fireEvent.change(screen.getByLabelText(/Observación · obligatoria/i), {
            target: { value: "La foto está borrosa." },
        });
        expect(confirmar.disabled, "con observación sí").toBe(false);
    });

    it("devolver: la línea a gerencia (único canal real, sin prometer suspensión)", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        fireEvent.click(screen.getByRole("button", { name: /^Devolverlo$/i }));
        expect(screen.getByText(/gerencia@innovadataco\.com/i)).toBeTruthy();
        expect(screen.getByText(/desde acá no se puede suspender a nadie/i)).toBeTruthy();
    });

    it("nunca la palabra «renovación» ni «renovar» en pantalla (FORMA §0)", () => {
        render(<DocumentoNuevoClient data={DATA} />);
        fireEvent.click(screen.getByRole("button", { name: /Aceptar este documento/i }));
        fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
        fireEvent.click(screen.getByRole("button", { name: /^Devolverlo$/i }));
        expect(document.body.textContent ?? "").not.toMatch(/renovaci|renovar/i);
    });
});
