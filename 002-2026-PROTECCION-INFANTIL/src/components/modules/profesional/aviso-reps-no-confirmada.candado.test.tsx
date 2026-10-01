/**
 * CANDADO · SPEC-836 (4ª variante) — el banner de NO_ENCONTRADA (estado 5) que ve el PROFESIONAL.
 *
 * REVISION_ADMIN funde 5/7/8. El 7 muestra re-verificación («su inscripción sigue al día»); en el 5 eso
 * MENTIRÍA (no aparece en el registro) → banner propio. Copy de Diseño (FORMA-SPEC790 v4.5, commit 2f88930,
 * voz usted). El 5 es AMBIGUO (no inscrito / laguna nuestra): la copy NO asigna causa, BIFURCA por lo que él
 * sabe. Contrato que lockea el candado:
 *  · BIFURCA: «si todavía no completó … complétela» + «si ya está inscrito y vigente, es algo de nuestro lado»;
 *  · dice el SÍNTOMA: «no pudimos confirmar … en pausa»;
 *  · TRES PARÁ del CEO: SIN «escríbanos» (el profesional no tiene canal), SIN «lo estamos revisando» (0
 *    verificadores = falso-conducta), y sin enlace;
 *  · NO culpa (nunca inhabilitado/sancionado/suspendido);
 *  · GATE: `avisoReps === "REVISION_ADMIN" && esNoConfirmadaReps` — el discriminador que lo separa del banner
 *    del 7 (`esReVerificacionReps`). Control positivo por EXCLUSIÓN: si el gate perdiera `esNoConfirmadaReps`,
 *    el 5 caería en el banner equivocado.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AvisoRepsNoConfirmada } from "./PanelProfesional";

const AQUI = dirname(fileURLToPath(import.meta.url));

afterEach(() => cleanup());

describe("SPEC-836 (4ª variante) · banner REPS no-confirmada / NO_ENCONTRADA (profesional)", () => {
    it("dice el síntoma (no confirmada → en pausa) y BIFURCA sin asignar causa", () => {
        render(<AvisoRepsNoConfirmada />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t, "el síntoma que él ve").toContain("no pudimos confirmar");
        expect(t).toContain("en pausa");
        expect(t, "rama 1: si no completó").toContain("si todavía no completó");
        expect(t, "rama 2: si ya está inscrito, es nuestro").toContain("es algo de nuestro lado");
    });

    it("TRES PARÁ del CEO: sin «escríbanos», sin «lo estamos revisando», y sin enlace", () => {
        const { container } = render(<AvisoRepsNoConfirmada />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t, "el profesional no tiene canal de soporte").not.toContain("escríbanos");
        expect(t, "0 verificadores: no afirmar una revisión que no ocurre").not.toContain("estamos revisando");
        expect(container.querySelectorAll("a").length, "no hay acción de enlace (no es un callejón ni una puerta inventada)").toBe(0);
    });

    it("NO culpa: nunca inhabilitado/sancionado/suspendido", () => {
        render(<AvisoRepsNoConfirmada />);
        const t = (document.body.textContent ?? "").toLowerCase();
        for (const prohibida of ["inhabilitad", "sancionad", "suspendid", "perdió el acceso"]) {
            expect(t, `no debe decir «${prohibida}»`).not.toContain(prohibida);
        }
    });

    it("GATE: se muestra con REVISION_ADMIN **Y** esNoConfirmadaReps (el discriminador vs el banner del 7)", () => {
        const panel = readFileSync(resolve(AQUI, "PanelProfesional.tsx"), "utf8");
        expect(panel).toMatch(
            /avisoReps === "REVISION_ADMIN"\s*&&\s*data\.esNoConfirmadaReps\s*&&[\s\S]{0,80}?<AvisoRepsNoConfirmada/,
        );
    });
});
