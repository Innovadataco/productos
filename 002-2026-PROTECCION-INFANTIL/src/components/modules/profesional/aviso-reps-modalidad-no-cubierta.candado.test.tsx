/**
 * CANDADO · SPEC-836 pieza 2 — el banner del HUECO DE MODALIDAD que ve el PROFESIONAL.
 *
 * 813 daba el aviso vigencia-only y dejaba `AL_DIA` a un profesional cuyo REPS vigente no cubre una
 * modalidad que OFRECE, mientras 825/834/814 ya actuaban sobre él. Este banner cierra ese silencio.
 *
 * El COPY es PROVISIONAL (pendiente de FORMA-SPEC836 pieza 2, pedida a Diseño por el CEO). Por eso el candado
 * lockea el CONTRATO ESTABLE —que sobrevive al swap de la copy final—, no el texto verbatim:
 *  · GATE del panel: el banner se muestra con `avisoReps === "MODALIDAD_NO_CUBIERTA"` (la clasificación en sí
 *    la lockea `aviso-estado-reps.candado.test.ts`);
 *  · NOMBRA la modalidad concreta (singular) y, en el hueco DOBLE, NOMBRA LAS DOS (no «arregla la mitad»);
 *  · tiene SALIDA (enlace a su perfil), nunca un callejón.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AvisoRepsModalidadNoCubierta } from "./PanelProfesional";

const AQUI = dirname(fileURLToPath(import.meta.url));

afterEach(() => cleanup());

describe("SPEC-836 pieza 2 · banner REPS hueco de modalidad (profesional)", () => {
    it("hueco SIMPLE nombra la modalidad concreta (virtual) y NO la que sí cubre (presencial)", () => {
        render(<AvisoRepsModalidadNoCubierta modalidades={["VIRTUAL"]} />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t).toContain("virtual");
        expect(t, "no nombra la modalidad que sí está cubierta").not.toContain("presencial");
    });

    it("hueco DOBLE nombra LAS DOS modalidades (no arregla la mitad)", () => {
        render(<AvisoRepsModalidadNoCubierta modalidades={["VIRTUAL", "PRESENCIAL"]} />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t).toContain("virtual");
        expect(t).toContain("presencial");
    });

    it("tiene las DOS SALIDAS en prosa (actualice su inscripción / deje de ofrecer), nunca sin salida", () => {
        render(<AvisoRepsModalidadNoCubierta modalidades={["VIRTUAL"]} />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t).toContain("actualice su inscripción");
        expect(t).toContain("deje de ofrecer");
    });

    it("no culpa: sujeto «su inscripción», nunca inhabilitado/sancionado/suspendido/perdió el acceso", () => {
        render(<AvisoRepsModalidadNoCubierta modalidades={["VIRTUAL"]} />);
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t).toContain("su inscripción");
        for (const prohibida of ["inhabilitad", "sancionad", "suspendid", "perdió el acceso", "perdió su acceso"]) {
            expect(t, `no debe decir «${prohibida}»`).not.toContain(prohibida);
        }
    });

    it("GATE del panel: el banner se muestra con `avisoReps === \"MODALIDAD_NO_CUBIERTA\"`", () => {
        const panel = readFileSync(resolve(AQUI, "PanelProfesional.tsx"), "utf8");
        expect(panel).toMatch(/avisoReps === "MODALIDAD_NO_CUBIERTA"\s*&&[\s\S]{0,120}?<AvisoRepsModalidadNoCubierta/);
    });
});
