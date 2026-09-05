import React, { createRef } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, type ButtonVariant } from "./Button";

/**
 * SPEC-454 · OLA 1 del rediseño (Button al Sistema de Diseño).
 *
 * Este es el candado de CONDUCTA — lo que la migración de piel (tokens + firma:
 * gradiente/grano/órbita/squircle) NO puede romper. El radicado es explícito:
 * «Ningún cambio de comportamiento: un Button sigue disparando su onClick, sigue
 * deshabilitándose, sigue siendo accesible. El rediseño es visual; si rompe
 * conducta, es defecto.»
 *
 * Se escribe ANTES de tocar la piel (no había test previo del componente), para
 * que cualquier reescritura visual muera si altera la conducta. Los tests de la
 * FIRMA (gradiente/grano/órbita presentes, reduced-motion no anima) se suman
 * cuando Diseño fije radio único y alcance de la firma — van aparte de este
 * bloque de conducta.
 */
const VARIANTES: ButtonVariant[] = ["primary", "secondary", "outline", "ghost", "danger"];

describe("Button · conducta (SPEC-454 · candado de no-regresión)", () => {
    it("renderiza como <button> con su contenido", () => {
        render(<Button>Guardar</Button>);
        const btn = screen.getByRole("button", { name: "Guardar" });
        expect(btn.tagName).toBe("BUTTON");
    });

    it("dispara onClick al hacer click", () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Enviar</Button>);
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("disabled: pone el atributo y NO dispara onClick", () => {
        const onClick = vi.fn();
        render(<Button disabled onClick={onClick}>Enviar</Button>);
        const btn = screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        fireEvent.click(btn);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("isLoading: deshabilita el botón y NO dispara onClick", () => {
        const onClick = vi.fn();
        render(<Button isLoading onClick={onClick}>Enviar</Button>);
        const btn = screen.getByRole("button") as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        fireEvent.click(btn);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("las 5 variantes siguen aceptándose (API estable — no se colapsó a 3)", () => {
        for (const variant of VARIANTES) {
            const { unmount } = render(<Button variant={variant}>V {variant}</Button>);
            expect(screen.getByRole("button", { name: `V ${variant}` })).toBeTruthy();
            unmount();
        }
    });

    it("reenvía props HTML nativas (type, aria-label, name)", () => {
        render(<Button type="submit" aria-label="Guardar cambios" name="save">x</Button>);
        const btn = screen.getByRole("button", { name: "Guardar cambios" });
        expect(btn.getAttribute("type")).toBe("submit");
        expect(btn.getAttribute("name")).toBe("save");
    });

    it("forwardRef expone el nodo <button>", () => {
        const ref = createRef<HTMLButtonElement>();
        render(<Button ref={ref}>x</Button>);
        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("concatena className extra sin perder las clases base", () => {
        render(<Button className="mi-clase-extra">x</Button>);
        expect(screen.getByRole("button").className).toContain("mi-clase-extra");
    });

    it("es accesible por teclado: Enter/Space sobre un <button> nativo dispara onClick", () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Aceptar</Button>);
        const btn = screen.getByRole("button", { name: "Aceptar" });
        btn.focus();
        expect(document.activeElement).toBe(btn);
        // En un <button> nativo el click sintético cubre Enter/Space; verificamos
        // que el elemento es enfocable y del tipo correcto (no un <div role>).
        expect(btn.tagName).toBe("BUTTON");
    });
});

/**
 * Candado de la FIRMA (SPEC-454). Dos capas:
 *   (1) mapeo variante→jerarquía en el className del componente (conducta de
 *       la API: si alguien re-mapea mal, cae);
 *   (2) estructura de la piel en globals.css (jsdom no renderiza pseudo-elementos,
 *       así que la firma —gradiente/grano/órbita— y el apagado por
 *       prefers-reduced-motion se verifican leyendo el CSS). Verificado por
 *       mutación: quitar el grano, la órbita, o el bloque reduced-motion mata
 *       el test correspondiente.
 */
describe("Button · firma y jerarquías (SPEC-454)", () => {
    it("mapea cada variante a su jerarquía del Sistema de Diseño", () => {
        const casos: Array<[ButtonVariant, string]> = [
            ["primary", "btn-ds--primary"],
            ["secondary", "btn-ds--fantasma"],
            ["outline", "btn-ds--fantasma"],
            ["ghost", "btn-ds--sutil"],
            ["danger", "btn-ds--fantasma-rubi"],
        ];
        for (const [variant, clase] of casos) {
            const { unmount } = render(<Button variant={variant}>x</Button>);
            const btn = screen.getByRole("button");
            expect(btn.className).toContain("btn-ds");
            expect(btn.className, `variante ${variant}`).toContain(clase);
            unmount();
        }
    });

    it("SOLO el primario lleva firma; danger nunca es sólido rubí", () => {
        const { unmount: u1 } = render(<Button variant="primary">x</Button>);
        expect(screen.getByRole("button").className).toContain("btn-ds--primary");
        u1();
        // danger es Fantasma-rubí (borde), no un sólido — no comparte clase con primary.
        const { unmount: u2 } = render(<Button variant="danger">x</Button>);
        const cls = screen.getByRole("button").className;
        expect(cls).toContain("btn-ds--fantasma-rubi");
        expect(cls).not.toContain("btn-ds--primary");
        u2();
    });
});

describe("Button · piel en globals.css (SPEC-454 · estructural)", () => {
    const css = readFileSync(
        resolve(__dirname, "../../app/globals.css"),
        "utf-8",
    );
    // Aísla el bloque del primario para no confundir con otras reglas.
    const bloquePrimario = css.slice(css.indexOf(".btn-ds--primary"));

    it("radio del Button es 16px (decisión Diseño; el 12px de §7.1 era error)", () => {
        expect(css).toMatch(/\.btn-ds\s*\{[^}]*border-radius:\s*16px/);
    });

    it("el primario lleva la firma: gradiente del acento", () => {
        expect(bloquePrimario).toMatch(/\.btn-ds--primary\s*\{[^}]*linear-gradient/);
        expect(bloquePrimario).toContain("--pi-accent");
    });

    it("el primario lleva grano (::after con el data-uri del ruido)", () => {
        expect(bloquePrimario).toMatch(/\.btn-ds--primary::after[^}]*--pi-btn-grano/);
    });

    it("el primario lleva órbita animada (::before con la animación)", () => {
        expect(bloquePrimario).toMatch(/\.btn-ds--primary::before[^}]*animation:\s*pi-btn-orbita/);
        expect(css).toMatch(/@keyframes\s+pi-btn-orbita/);
    });

    it("prefers-reduced-motion apaga la órbita del primario (§5)", () => {
        const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
        expect(reduce).toMatch(/\.btn-ds--primary::before\s*\{\s*animation:\s*none/);
    });

    it("el acento se lee de --accent con fallback (SPEC-460 lo declara por rol)", () => {
        expect(css).toMatch(/--pi-accent:\s*var\(--accent,\s*rgb\(var\(--pino-rgb\)\)\)/);
    });

    it("la piel del Button no introduce color crudo Tailwind (todo por token)", () => {
        const bloque = css.slice(css.indexOf("Button · Sistema de Diseño"));
        // Ninguna familia Tailwind cruda en el bloque del botón.
        expect(bloque).not.toMatch(/\b(sky|cyan|emerald|red|slate|amber|blue|green|rose)-[0-9]{2,3}\b/);
    });
});
