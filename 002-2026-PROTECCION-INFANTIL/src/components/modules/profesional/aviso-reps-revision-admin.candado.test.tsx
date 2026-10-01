/**
 * CANDADO · SPEC-836 pieza 2 — el banner de RE-VERIFICACIÓN NUESTRA (estado 7) que ve el PROFESIONAL.
 *
 * v4.1 enrutaba REVISION_ADMIN solo al admin; el CEO lo revirtió (825/814 volvieron el silencio portante).
 * Copy de Diseño (FORMA-SPEC790 v4.3, commit 45e1623), voz usted. Contrato que lockea el candado:
 *  · DOS oraciones, ambas obligatorias: la 1.ª tranquiliza (es nuestro chequeo, nada que hacer), la 2.ª
 *    explica el síntoma (su oferta en pausa) — sin la 2.ª el banner no conecta con lo que él observa;
 *  · SIN plazo (ata al evento, no al reloj): nunca «en breve/pronto/en N días»;
 *  · NO culpa: nunca «inhabilitado/sancionado/suspendido/perdió el acceso»;
 *  · GATE: se muestra con `avisoReps === "REVISION_ADMIN" && esReVerificacionReps` — NO con REVISION_ADMIN a
 *    secas, porque ese fusiona el estado 5 (NO_ENCONTRADA), donde «su inscripción sigue al día» sería FALSO.
 *    Esta es la protección del estado 5: si el gate perdiera `esReVerificacionReps`, volvería la mentira.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AvisoRepsRevisionAdmin } from "./PanelProfesional";

const AQUI = dirname(fileURLToPath(import.meta.url));

afterEach(() => cleanup());

describe("SPEC-836 pieza 2 · banner REPS re-verificación nuestra (profesional)", () => {
    it("DOS oraciones: tranquiliza (es nuestro, nada que hacer) Y explica el síntoma (oferta en pausa)", () => {
        render(<AvisoRepsRevisionAdmin />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t, "1.ª — es nuestro chequeo").toContain("chequeo nuestro");
        expect(t, "1.ª — nada que hacer").toContain("nada que usted deba hacer");
        expect(t, "2.ª — el síntoma que él ve").toContain("en pausa");
        expect(t, "2.ª — vuelve sola, ata al evento").toContain("vuelve por sí sola");
    });

    it("SIN plazo (ata al evento, no al reloj): nunca «en breve/pronto/en N días»", () => {
        render(<AvisoRepsRevisionAdmin />);
        const t = (document.body.textContent ?? "").toLowerCase();
        for (const prohibida of ["en breve", "pronto", "días", "horas", "en 24", "plazo"]) {
            expect(t, `no debe prometer «${prohibida}»`).not.toContain(prohibida);
        }
    });

    it("NO culpa (es nuestro): nunca inhabilitado/sancionado/suspendido/perdió el acceso", () => {
        render(<AvisoRepsRevisionAdmin />);
        const t = (document.body.textContent ?? "").toLowerCase();
        for (const prohibida of ["inhabilitad", "sancionad", "suspendid", "perdió el acceso", "perdió su acceso"]) {
            expect(t, `no debe decir «${prohibida}»`).not.toContain(prohibida);
        }
    });

    it("GATE: se muestra con REVISION_ADMIN **Y** esReVerificacionReps (protege al estado 5 de la mentira)", () => {
        const panel = readFileSync(resolve(AQUI, "PanelProfesional.tsx"), "utf8");
        expect(panel).toMatch(
            /avisoReps === "REVISION_ADMIN"\s*&&\s*data\.esReVerificacionReps\s*&&[\s\S]{0,80}?<AvisoRepsRevisionAdmin/,
        );
    });
});
