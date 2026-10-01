/**
 * CANDADO · SPEC-751 T010 §2 · el renglón «oír al menor» en el flujo de pedir cita.
 *
 * Conductas que no se pueden fingir:
 *  - Es HEADS-UP, NO muro: informa y acompaña, y NUNCA dice «no puedes pedir la cita hasta…»
 *    (sería mentira con el gate apagado). Honesto en los dos estados del gate.
 *  - Solo aparece cuando hay audiencia(s) pendiente(s) (count ≥ 1); con count 0 no renderiza nada.
 *  - Enlaza a la pantalla §1 (`/audiencia-menor`). Singular/plural según el conteo. Voz tú.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { RenglonAudienciaCita } from "./RenglonAudienciaCita";

const RUTA = path.resolve(process.cwd(), "src/components/modules/padre/profesionales/RenglonAudienciaCita.tsx");
const SRC = fs.readFileSync(RUTA, "utf-8");

afterEach(() => cleanup());

describe("SPEC-751 T010 §2 · renglón heads-up", () => {
    it("con count 0 no renderiza nada (no es un muro para quien no debe nada)", () => {
        const { container } = render(<RenglonAudienciaCita count={0} />);
        expect(container.innerHTML).toBe("");
    });

    it("con count 1 informa (singular) y enlaza a /audiencia-menor", () => {
        render(<RenglonAudienciaCita count={1} />);
        expect(screen.getByText(/Escuchar a tu hijo es parte de cuidarlo aquí/)).toBeTruthy();
        const enlace = screen.getByRole("link", { name: /¿Qué es esto\?/ }) as HTMLAnchorElement;
        expect(enlace.getAttribute("href")).toBe("/audiencia-menor");
    });

    it("con count 2 usa el plural", () => {
        render(<RenglonAudienciaCita count={2} />);
        expect(screen.getByText(/Escuchar a tus hijos es parte de cuidarlos aquí/)).toBeTruthy();
    });

    it("NUNCA bloquea la cita (no es muro) — candado de CONDUCTA sobre el render", () => {
        // Conducta, no palabras: medimos lo RENDERIZADO (no un grep de la fuente, que cazaría el
        // propio comentario que cita la frase prohibida). El renglón informa, no amenaza con bloquear.
        render(<RenglonAudienciaCita count={1} />);
        expect(screen.queryByText(/no puedes pedir la cita hasta/i)).toBeNull();
        expect(screen.queryByText(/no puedes|hasta que|bloque/i)).toBeNull();
    });

    it("voz tú — sin «usted» en la fuente del componente", () => {
        expect(SRC).not.toMatch(/\busted\b/i);
    });
});
