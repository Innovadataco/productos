/**
 * CANDADO · SPEC-784 (C-3) — el formulario NO PUEDE construir la combinación que el CHECK rechaza
 * (FR-3, imposibilidad estructural) ni ofrecer texto libre (FR-5).
 *
 * Control positivo por CONSTRUCCIÓN: la P1 gobierna el ÁRBOL DE RENDER. Se afirma en las dos
 * direcciones — con «Sí» la razón NO existe en el DOM y la duración sí; con «No» al revés—, así que si
 * alguien cambiara el condicional (o pusiera ambas siempre), el candado cae. Se verifica por el atributo
 * `name` del radio (= la clave de la pregunta, que el módulo SÍ fija), no por la prosa (autoridad de
 * Diseño, que se mueve). Unit (jsdom).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { EncuestaFormulario } from "./EncuestaFormulario";

afterEach(cleanup);

const radios = (name: string) =>
    document.querySelectorAll(`input[type="radio"][name="${name}"]`);

function elegir(name: string, value: string) {
    const el = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${name}"][value="${value}"]`);
    if (!el) throw new Error(`no hay radio ${name}=${value}`);
    el.click();
}

describe("SPEC-784 · C-3 · imposibilidad estructural del CHECK + cero texto libre", () => {
    it("la P1 gobierna el árbol: SÍ → duración y NO razón; NO → razón y NO duración", () => {
        render(<EncuestaFormulario solicitudId="s1" origen="PADRE" fecha="27 de septiembre" />);
        // Q3/Q4/Q5 aparecen siempre; razón y duración aún NO (P1 sin responder).
        expect(radios("OPERADOR").length, "Q3 debe existir siempre").toBeGreaterThan(0);
        expect(radios("INICIO").length).toBeGreaterThan(0);
        expect(radios("ENLACE").length).toBeGreaterThan(0);
        expect(radios("RAZON").length, "sin responder P1, la razón no existe").toBe(0);
        expect(radios("DURACION").length, "sin responder P1, la duración no existe").toBe(0);

        elegir("SE_REALIZO", "SI");
        expect(radios("DURACION").length, "con «Sí» la duración aparece").toBeGreaterThan(0);
        expect(radios("RAZON").length, "con «Sí» la razón NO puede existir").toBe(0);

        elegir("SE_REALIZO", "NO");
        expect(radios("RAZON").length, "con «No» la razón aparece").toBeGreaterThan(0);
        expect(radios("DURACION").length, "con «No» la duración DESAPARECE (no «N/A»)").toBe(0);
    });

    it("CERO texto libre: sólo hay radios (ni textarea ni input de texto); «Otra» no abre campo", () => {
        render(<EncuestaFormulario solicitudId="s1" origen="PADRE" fecha="27 de septiembre" />);
        elegir("SE_REALIZO", "NO"); // estado con la razón visible, incluida la opción «Otra»
        expect(document.querySelectorAll("textarea").length).toBe(0);
        for (const input of Array.from(document.querySelectorAll("input"))) {
            expect(input.getAttribute("type"), "input no-radio en el formulario").toBe("radio");
        }
    });

    it("EJE DE AUDIENCIA: el formulario lee los labels de la razón distinto para padre y profesional", () => {
        const textos = (origen: "PADRE" | "PROFESIONAL") => {
            const { unmount } = render(<EncuestaFormulario solicitudId="s1" origen={origen} fecha="hoy" />);
            elegir("SE_REALIZO", "NO");
            const t = Array.from(document.querySelectorAll("input[name=RAZON]")).map(
                (i) => i.closest("label")?.textContent ?? "",
            );
            unmount();
            return t;
        };
        // Mismas keys, distinta lectura: la única role-relative hace que el conjunto de textos difiera.
        expect(textos("PADRE")).not.toEqual(textos("PROFESIONAL"));
    });
});
