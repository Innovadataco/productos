/**
 * CANDADO · SPEC-751 T010 §2 · el renglón «oír al menor» en el flujo de pedir cita (FORMA v1.1, 9ced530).
 *
 * Conductas que no se pueden fingir:
 *  - GENÉRICO sin nombre ni género: copy plural inclusivo «tus hijos» (la cita no es por-hijo, no hay
 *    `hijoId` → no se sabe cuál ni el género). NUNCA el singular masculino «tu hijo» — ni con count 1.
 *  - HEADS-UP, NO muro: informa y acompaña, y NUNCA dice «no puedes pedir la cita hasta…».
 *  - Solo aparece con audiencia(s) pendiente(s) (count ≥ 1); con count 0 no renderiza nada.
 *  - Tono NEUTRO (cero alarma: sin ámbar ni rubí) para no competir con la línea de emergencia (D-120).
 *  - Enlaza a la pantalla §1 (`/audiencia-menor`). Voz tú.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { RenglonAudienciaCita } from "./RenglonAudienciaCita";

const RUTA = path.resolve(process.cwd(), "src/components/modules/padre/profesionales/RenglonAudienciaCita.tsx");
const SRC = fs.readFileSync(RUTA, "utf-8");

afterEach(() => cleanup());

describe("SPEC-751 T010 §2 · renglón heads-up genérico", () => {
    it("con count 0 no renderiza nada (no es un muro para quien no debe nada)", () => {
        const { container } = render(<RenglonAudienciaCita count={0} />);
        expect(container.innerHTML).toBe("");
    });

    it("con count 1 usa el plural genérico «tus hijos» (nunca el singular masculino) y enlaza a §1", () => {
        render(<RenglonAudienciaCita count={1} />);
        expect(screen.getByText(/Escuchar a tus hijos, según su edad, es parte de cuidarlos aquí/)).toBeTruthy();
        // Sin género conocido: el singular masculino «tu hijo» fallaría con una hija → no debe aparecer.
        expect(screen.queryByText(/Escuchar a tu hijo\b/)).toBeNull();
        const enlace = screen.getByRole("link", { name: /¿Qué es esto\?/ }) as HTMLAnchorElement;
        expect(enlace.getAttribute("href")).toBe("/audiencia-menor");
    });

    it("con count 2 mantiene el mismo plural genérico", () => {
        render(<RenglonAudienciaCita count={2} />);
        expect(screen.getByText(/Escuchar a tus hijos, según su edad, es parte de cuidarlos aquí/)).toBeTruthy();
    });

    it("NUNCA bloquea la cita (no es muro) — candado de CONDUCTA sobre el render", () => {
        // Conducta, no palabras: medimos lo RENDERIZADO (no un grep de la fuente, que cazaría el
        // propio comentario que cita la frase prohibida). El renglón informa, no amenaza con bloquear.
        render(<RenglonAudienciaCita count={1} />);
        expect(screen.queryByText(/no puedes pedir la cita hasta/i)).toBeNull();
        expect(screen.queryByText(/no puedes|hasta que|bloque/i)).toBeNull();
    });

    it("tono NEUTRO: la superficie no usa color de alarma (ámbar/rubí) — D-120", () => {
        // Sobre la clase RENDERIZADA (no la fuente: el comentario nombra los colores prohibidos).
        render(<RenglonAudienciaCita count={1} />);
        const nota = screen.getByRole("note");
        expect(nota.className).not.toMatch(/ambar|rub[ií]/);
    });

    it("voz tú — sin «usted» en la fuente del componente", () => {
        expect(SRC).not.toMatch(/\busted\b/i);
    });
});
