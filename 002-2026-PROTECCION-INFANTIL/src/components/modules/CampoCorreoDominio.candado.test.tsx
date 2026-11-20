/**
 * SPEC-958 (M5a) · CANDADO del campo de correo partido con dominio institucional.
 * FORMA-M5a-CAMPO-CORREO-PARTIDO-COLEGIO (Gestión 09ac9ee0, §4 strings finales).
 *
 * Dos invariantes:
 *  1. Dominio institucional: cuando el rector tiene dominio PROPIO (no genérico), el
 *     campo lo ofrece como 1.ª opción (chip destacado) + ayuda «es el dominio de su
 *     colegio». Rector con dominio genérico → NADA inventado (sin chip institucional).
 *  2. Voz IMPERSONAL REAL: el componente es COMPARTIDO (padre tú + colegio usted), así
 *     que su micro-copy no lleva 2.ª persona (ni «toca» tú ni «toque» usted). Mutar a
 *     «toque»/«toca» → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { CampoCorreoDominio } from "./CampoCorreoDominio";
import { dominioInstitucionalDe } from "@/lib/email-typo";

describe("SPEC-958 · dominioInstitucionalDe (clasificación por DOMINIOS_COMUNES)", () => {
    it("rector con dominio PROPIO → devuelve el dominio", () => {
        expect(dominioInstitucionalDe("rectoria@colegiosanjose.edu.co")).toBe("colegiosanjose.edu.co");
    });
    it("rector con dominio GENÉRICO → null (no se ofrece como institucional)", () => {
        expect(dominioInstitucionalDe("rector@gmail.com")).toBeNull();
        expect(dominioInstitucionalDe("rector@hotmail.es")).toBeNull();
    });
    it("sin «@», sin punto, vacío o nulo → null", () => {
        expect(dominioInstitucionalDe("rector")).toBeNull();
        expect(dominioInstitucionalDe("rector@localhost")).toBeNull();
        expect(dominioInstitucionalDe("")).toBeNull();
        expect(dominioInstitucionalDe(null)).toBeNull();
    });
});

describe("SPEC-958 · CampoCorreoDominio: el dominio del colegio como 1.ª opción", () => {
    it("CON institucional: ofrece el chip @dominio destacado + la ayuda, y lo preselecciona", () => {
        render(
            <CampoCorreoDominio
                label="Email"
                value=""
                onChange={() => {}}
                dominioInstitucional="colegiosanjose.edu.co"
                preseleccionarInstitucional
            />,
        );
        const chip = screen.getByRole("button", { name: "@colegiosanjose.edu.co" });
        expect(chip).toBeTruthy();
        // Preseleccionado para el profesor.
        expect(chip.getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText("El primero es el dominio de su colegio.")).toBeTruthy();
    });

    it("SIN institucional (rector genérico): NO hay chip institucional ni ayuda (nada inventado)", () => {
        render(<CampoCorreoDominio label="Email" value="" onChange={() => {}} dominioInstitucional={null} />);
        expect(screen.queryByText("El primero es el dominio de su colegio.")).toBeNull();
        // Los chips comunes sí están; ninguno es un dominio institucional «@…».
        expect(screen.getByRole("button", { name: "gmail.com" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^@/ })).toBeNull();
    });
});

describe("SPEC-958 · voz IMPERSONAL REAL (componente compartido padre/colegio)", () => {
    const fuente = readFileSync(
        path.join(process.cwd(), "src/components/modules/CampoCorreoDominio.tsx"),
        "utf-8",
    )
        // Sin comentarios: la micro-copy visible, no las notas del Dev.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    // Formas de 2.ª persona (tú imperativo o usted imperativo) que romperían la
    // neutralidad. El copy final usa infinitivos («elegir», «usar») y sustantivos.
    const SEGUNDA_PERSONA = [
        /\btoca\b/i, /\btoque\b/i, /\bquisiste\b/i, /\belige\b/i, /\belija\b/i,
        /\bescribe\b/i, /\bescriba\b/i, /\bingresa\b/i, /\bingrese\b/i,
        /\bselecciona\b/i, /\bseleccione\b/i,
    ];

    it("la micro-copy no contiene ningún verbo de 2.ª persona", () => {
        for (const re of SEGUNDA_PERSONA) {
            expect(fuente, `voz 2.ª persona prohibida: ${re}`).not.toMatch(re);
        }
    });

    it("conserva los strings finales impersonales (infinitivo)", () => {
        expect(fuente).toMatch(/elegir dominio/);
        expect(fuente).toMatch(/Posible corrección/);
        expect(fuente).toMatch(/placeholderLocal = "usuario"/);
    });
});
