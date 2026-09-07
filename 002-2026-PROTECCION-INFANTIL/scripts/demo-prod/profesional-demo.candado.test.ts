/**
 * SPEC-499 · candado del PROFESIONAL demo. Dos garantías que hacen que el
 * dato sirva para su propósito (caminar el ciclo de primera cita) y no deje
 * basura en prod:
 *
 *  1. APARECE Y ES RESERVABLE. El directorio del padre exige perfil `ACTIVO`
 *     **y** una verificación `APROBADO` vigente (SPEC-449, verificado contra
 *     `src/app/api/padre/profesionales`). Se alimenta la MISMA forma que
 *     siembra el script a `puedeAparecerEnDirectorio`. Muere por mutación:
 *     bajar el estado o quitar la verificación → el profesional desaparece.
 *  2. ES PURGABLE. Las tres entidades nuevas están en `ORDEN_BORRADO` y en
 *     orden FK-seguro: las hijas del perfil antes que el perfil, y el perfil
 *     antes que el usuario. Muere si alguien las saca o las reordena.
 */
import { describe, it, expect } from "vitest";
import { puedeAparecerEnDirectorio } from "@/lib/profesionales/vigencia";
import { ESTADO_PERFIL_DEMO, REVISADO_HACE_DIAS, verificacionDemo } from "./lib/profesional-demo";
import { ORDEN_BORRADO } from "./lib/orden-borrado";

const AHORA = new Date();
const revisadoEn = new Date(AHORA.getTime() - REVISADO_HACE_DIAS * 24 * 60 * 60 * 1000);

describe("SPEC-499 · el profesional demo aparece y es reservable", () => {
    it("perfil ACTIVO + verificación APROBADA vigente → aparece en el directorio", () => {
        expect(
            puedeAparecerEnDirectorio({ estado: ESTADO_PERFIL_DEMO }, [verificacionDemo(revisadoEn)], AHORA),
        ).toBe(true);
    });

    it("muere si el perfil no es ACTIVO (mutación del estado sembrado)", () => {
        expect(
            puedeAparecerEnDirectorio({ estado: "BORRADOR" }, [verificacionDemo(revisadoEn)], AHORA),
        ).toBe(false);
    });

    it("muere sin verificación aprobada — el punto de SPEC-499: ACTIVO no basta", () => {
        expect(puedeAparecerEnDirectorio({ estado: ESTADO_PERFIL_DEMO }, [], AHORA)).toBe(false);
    });
});

describe("SPEC-499 · el profesional demo es purgable (orden FK-seguro)", () => {
    const idx = (entidad: string) => ORDEN_BORRADO.indexOf(entidad);

    it("las tres entidades nuevas están en ORDEN_BORRADO", () => {
        for (const entidad of ["VerificacionProfesional", "FranjaDisponible", "PerfilProfesional"]) {
            expect(idx(entidad)).toBeGreaterThanOrEqual(0);
        }
    });

    it("las hijas del perfil se borran antes que el perfil, y el perfil antes que el usuario", () => {
        expect(idx("FranjaDisponible")).toBeLessThan(idx("PerfilProfesional"));
        expect(idx("VerificacionProfesional")).toBeLessThan(idx("PerfilProfesional"));
        expect(idx("PerfilProfesional")).toBeLessThan(idx("Usuario"));
    });
});
