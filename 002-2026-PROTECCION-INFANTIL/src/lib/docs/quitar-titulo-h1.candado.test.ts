/**
 * SPEC-576 (I-359) · `quitarTituloH1` quita SOLO el título H1 principal (al inicio), para que el panel
 * de `colegio/confianza` no pinte el título dos veces. No toca secciones (`##`/`###`) ni el cuerpo.
 */
import { describe, it, expect } from "vitest";
import { quitarTituloH1 } from "./quitar-titulo-h1";

describe("SPEC-576 · quitarTituloH1 (sin título duplicado)", () => {
    it("quita el H1 principal del inicio", () => {
        expect(quitarTituloH1("# Transparencia institucional\n\nCuerpo del documento.").trim()).toBe(
            "Cuerpo del documento.",
        );
    });

    it("NO toca ## ni ### (son secciones legítimas del cuerpo)", () => {
        expect(quitarTituloH1("## Sección\nCuerpo.")).toBe("## Sección\nCuerpo.");
        expect(quitarTituloH1("### Sub\nCuerpo.")).toBe("### Sub\nCuerpo.");
    });

    it("sin H1 al inicio → no cambia nada", () => {
        expect(quitarTituloH1("Cuerpo sin título.\n## luego una sección")).toBe("Cuerpo sin título.\n## luego una sección");
    });

    it("tolera líneas en blanco antes del H1", () => {
        expect(quitarTituloH1("\n\n# Título\nCuerpo.").trim()).toBe("Cuerpo.");
    });

    it("solo el título principal: un # que NO está al inicio no se toca", () => {
        const md = "## Intro\ntexto\n# No es el principal\nmás";
        expect(quitarTituloH1(md)).toBe(md);
    });
});
