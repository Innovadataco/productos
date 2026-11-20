/**
 * SPEC-954 (UX alta colegio · Jelkin vivo, prod e3d0f98f) · CANDADO:
 * el año de nacimiento del adulto (profesor/rector) se ELIGE de una lista que
 * SÓLO ofrece años de 18–80 años. Un año fuera de rango es estructuralmente
 * imposible, no sólo validado al enviar.
 *
 * MUERE si alguien:
 *   · abre el rango (p. ej. sube EDAD_MAX_ADULTO) → aparece un año prohibido,
 *   · invierte el orden (debe ser descendente, el más reciente arriba),
 *   · vuelve el control a un `<input type="number">` libre.
 *
 * La red de seguridad del servidor (`profesorBodySchema.anioNacimiento`) NO se
 * toca: comparte las MISMAS constantes de edad (control positivo abajo).
 *
 * Render jsdom puro, sin base de datos: registrado en el shard UNIT
 * (vitest.unit.includes.ts).
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SelectorAnioNacimiento } from "./SelectorAnioNacimiento";
import {
    aniosNacimientoAdulto,
    rangoAnioNacimientoAdulto,
    EDAD_MIN_ADULTO,
    EDAD_MAX_ADULTO,
} from "@/lib/identidad/anio-nacimiento";

describe("SPEC-954 · rango de años (fuente única, determinista)", () => {
    it("aniosNacimientoAdulto(2026) = 2008..1946, descendente, 63 años, sin fuera de rango", () => {
        const anios = aniosNacimientoAdulto(2026);
        expect(anios[0]).toBe(2008); // 2026 − 18 (más reciente, arriba)
        expect(anios[anios.length - 1]).toBe(1946); // 2026 − 80
        expect(anios.length).toBe(2008 - 1946 + 1); // 63
        // estrictamente descendente
        for (let i = 1; i < anios.length; i++) expect(anios[i]).toBe(anios[i - 1] - 1);
        // NINGÚN año fuera de [1946, 2008]
        expect(anios.some((a) => a > 2008 || a < 1946)).toBe(false);
        // los bordes prohibidos NO están
        expect(anios).not.toContain(2009); // 17 años
        expect(anios).not.toContain(1945); // 81 años
    });

    it("las constantes de edad son 18 y 80 (las que comparte el schema)", () => {
        expect(EDAD_MIN_ADULTO).toBe(18);
        expect(EDAD_MAX_ADULTO).toBe(80);
        const { minAnio, maxAnio } = rangoAnioNacimientoAdulto(2026);
        expect(maxAnio - minAnio).toBe(EDAD_MAX_ADULTO - EDAD_MIN_ADULTO);
    });
});

describe("SPEC-954 · el control es un selector, no un año libre", () => {
    const render1 = () =>
        render(<SelectorAnioNacimiento value="" onChange={vi.fn()} />);

    it("es un <select> con placeholder «Elija…», NO un <input type=number>", () => {
        const { container } = render1();
        const campo = screen.getByLabelText("Año de nacimiento") as HTMLElement;
        expect(campo.tagName).toBe("SELECT");
        expect(container.querySelector('input[type="number"]')).toBeNull();
        expect(within(campo).getByRole("option", { name: "Elija…" })).toBeTruthy();
    });

    it("ofrece los bordes del rango vivo y NO los años prohibidos", () => {
        const ahora = new Date().getFullYear();
        const { maxAnio, minAnio } = rangoAnioNacimientoAdulto(ahora);
        render1();
        const campo = screen.getByLabelText("Año de nacimiento") as HTMLElement;
        // bordes válidos presentes
        expect(within(campo).getByRole("option", { name: String(maxAnio) })).toBeTruthy();
        expect(within(campo).getByRole("option", { name: String(minAnio) })).toBeTruthy();
        // un año más joven que 18 o más viejo que 80 NO se ofrece
        expect(within(campo).queryByRole("option", { name: String(maxAnio + 1) })).toBeNull();
        expect(within(campo).queryByRole("option", { name: String(minAnio - 1) })).toBeNull();
    });

    it("el primer año ofrecido es el más reciente (orden descendente)", () => {
        render1();
        const campo = screen.getByLabelText("Año de nacimiento") as HTMLSelectElement;
        // opción 0 es el placeholder; 1 y 2 son años reales, descendentes
        const o1 = Number(campo.options[1].value);
        const o2 = Number(campo.options[2].value);
        expect(o1).toBe(rangoAnioNacimientoAdulto().maxAnio);
        expect(o1).toBeGreaterThan(o2);
    });
});
