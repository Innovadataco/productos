/**
 * SPEC-437 (punto 5) · candado del saludo.
 *
 * El caso que lo origina es literal: Jelkin entró como profesional y el panel
 * le dijo **«Hola, ¡Hola!»**. El valor que había en `nombreVisible` es el que
 * está en el primer test — no uno inventado.
 */
import { describe, it, expect } from "vitest";
import { saludoDelPanel, nombreParaSaludo, pareceUnNombre } from "./saludo";

const PRESENTACION_REAL = "¡Hola! mi nombre es Beatriz, aunque todo el mundo me llama Bea y así me presento con las familias";

describe("SPEC-437 · el saludo del panel nunca repite «Hola»", () => {
    it("reproducción del defecto: la presentación de Jelkin ya no produce «Hola, ¡Hola!»", () => {
        const saludo = saludoDelPanel(null, PRESENTACION_REAL);

        expect(saludo).not.toBe("Hola, ¡Hola!");
        expect(saludo).not.toContain("¡");
        expect(saludo).toBe("Hola");
    });

    it("con el nombre de la cuenta saluda con el nombre, no con el campo libre", () => {
        expect(saludoDelPanel("Beatriz Gómez", PRESENTACION_REAL)).toBe("Hola, Beatriz");
    });

    it("el nombre de la cuenta manda sobre `nombreVisible` aunque los dos sirvan", () => {
        expect(nombreParaSaludo("Beatriz", "Bea la psicóloga")).toBe("Beatriz");
    });

    it("si la cuenta no tiene nombre pero `nombreVisible` es corto y limpio, lo usa", () => {
        expect(saludoDelPanel(null, "Bea")).toBe("Hola, Bea");
        expect(saludoDelPanel("", "Ana María Restrepo")).toBe("Hola, Ana");
    });

    it("sin ningún dato utilizable saluda sin nombre, nunca con basura", () => {
        expect(saludoDelPanel(null, null)).toBe("Hola");
        expect(saludoDelPanel("   ", "")).toBe("Hola");
    });
});

describe("SPEC-437 · qué cuenta como nombre y qué no", () => {
    it.each([
        ["Beatriz", true],
        ["Ana María", true],
        ["Juan Carlos Pérez Gómez", true],
        [PRESENTACION_REAL, false],
        ["¡Hola!", false],
        ["Hola, soy Bea", false],
        ["Buenas, me llamo Ana", false],
        ["psicologa_bea@correo.com", false],
        ["Bea 2024", false],
        ["Psicóloga infantil con 12 años de experiencia acompañando familias", false],
        ["", false],
    ])("«%s» → %s", (valor, esperado) => {
        expect(pareceUnNombre(valor as string)).toBe(esperado);
    });

    it("un nombre de cinco palabras ya no es un nombre: es una frase", () => {
        expect(pareceUnNombre("Ana María del Carmen Restrepo")).toBe(false);
    });
});
