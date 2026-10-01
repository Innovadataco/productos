/**
 * CANDADO · SPEC-813 — el banner «fuera de la oferta» que ve el PROFESIONAL (REPS caducado).
 *
 * De FORMA-SPEC790-AVISO v4.1:
 *  · conserva el ACCESO, pierde la OFERTA — nunca «perdió el acceso», nunca lo manda a un muro;
 *  · NO promete reasignación («se reasigna/reubicamos») ni notificación («le avisaremos/notificaremos»);
 *  · NO predica «habilitado(s)/habilitada(s)» del profesional (candado de copy 811/813) — la OFERTA es el eje;
 *  · DISPARA solo con el estado CADUCADO explícito (4/6): el panel lo muestra con `avisoReps === "CADUCADO"`,
 *    no con `¬repsAlDia` (que fundiría 5/7/8 y «sin verificar»). La clasificación en sí la lockea
 *    `aviso-estado-reps.candado.test.ts`; acá se lockea el GATE del panel.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AvisoRepsCaducado } from "./PanelProfesional";

const AQUI = dirname(fileURLToPath(import.meta.url));

afterEach(() => cleanup());

describe("SPEC-813 · banner REPS caducado (profesional)", () => {
    it("conserva el acceso y enuncia «fuera de la oferta» — nunca «perdió el acceso»", () => {
        render(<AvisoRepsCaducado />);
        expect(screen.getByText(/por ahora no lo estamos ofreciendo a las familias/i)).toBeTruthy();
        const t = (document.body.textContent ?? "").toLowerCase();
        expect(t).toContain("no pierde su cuenta ni su acceso");
        expect(t, "no debe decir «perdió/perdiste el acceso»").not.toMatch(/perd(ió|iste|er) (el|su) acceso/);
    });

    it("NO promete reasignación ni notificación (no existe el reasignador; T7)", () => {
        render(<AvisoRepsCaducado />);
        const t = (document.body.textContent ?? "").toLowerCase();
        for (const prohibida of ["se reasigna", "reasignan", "reubica", "le avisa", "le notifica", "le avisaremos", "le notificaremos"]) {
            expect(t, `el aviso no puede prometer «${prohibida}»`).not.toContain(prohibida);
        }
    });

    it("NO predica «habilitado(s)/habilitada(s)» del profesional (copy 811/813)", () => {
        render(<AvisoRepsCaducado />);
        expect(document.body.textContent ?? "", "la OFERTA es el eje; «habilitado» no se le predica").not.toMatch(/habilitad[oa]s?/i);
    });

    it("el enlace lleva al perfil/estado (la explicación + cómo renovar), no es un callejón", () => {
        render(<AvisoRepsCaducado />);
        const enlace = screen.getByRole("link", { name: /ver qué significa y cómo renovar/i });
        expect(enlace.getAttribute("href")).toBe("/dashboard/profesional/mi-perfil");
    });

    it("GATE del panel: el banner se muestra con `avisoReps === \"CADUCADO\"`, no con ¬repsAlDia", () => {
        const panel = readFileSync(resolve(AQUI, "PanelProfesional.tsx"), "utf8");
        expect(panel).toMatch(/avisoReps === "CADUCADO"\s*&&\s*<AvisoRepsCaducado/);
        // No se dispara por la negación cruda (el defecto que SPEC-813 corrige).
        expect(panel).not.toMatch(/!\s*\w*\.?repsAlDia\s*&&\s*<AvisoRepsCaducado/);
    });
});
