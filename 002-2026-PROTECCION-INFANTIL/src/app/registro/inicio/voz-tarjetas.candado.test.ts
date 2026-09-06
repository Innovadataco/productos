/**
 * SPEC-525 · CANDADO: la pantalla PÚBLICA de selección de rol (/registro/inicio)
 * habla por AUDIENCIA de cada tarjeta — colegio y profesional = «usted» — mientras
 * la PUERTA pública (título, intro, «¿Ya tienes cuenta?») conserva «tú».
 *
 * Lección que cablea este candado (mapa SPEC-525): un candado de voz por-audiencia
 * escanea EL RENDER DE LA PANTALLA, no el directorio de la audiencia. Estas cadenas
 * viven en un árbol PÚBLICO (`app/registro/inicio/`), por eso ni el barrido de
 * colegio (SPEC-523, scope dashboard/colegio) ni el candado del profesional
 * (scope profesional) las cazaban. Acota `dev-candado-escanea-el-render-no-el-directorio`.
 *
 * Verificado por MUTACIÓN: reponer «Gestiona…tus estudiantes» o «Recibí» → rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE = path.resolve(__dirname, "page.tsx");

describe("SPEC-525 · /registro/inicio: tarjetas en «usted», puerta pública en «tú»", () => {
    const codigo = fs.readFileSync(PAGE, "utf-8");

    it("tarjeta Colegio habla de «usted» (no tuteo)", () => {
        expect(codigo).toContain(
            "Gestione la protección de sus estudiantes, active alertas y coordine con las familias.",
        );
        expect(codigo).not.toContain("Gestiona la protección de tus estudiantes");
        expect(codigo).not.toContain("activa alertas");
        expect(codigo).not.toContain("coordina con las familias");
    });

    it("tarjeta Profesional habla de «usted» (no voseo)", () => {
        expect(codigo).toContain("Reciba solicitudes de padres");
        expect(codigo).not.toContain("Recibí solicitudes de padres");
    });

    it("contraprueba: la PUERTA pública conserva «tú» (no se migró de más)", () => {
        // El título es la puerta pública (primer contacto): queda en «tú».
        expect(codigo).toContain("¿Quién eres?");
    });
});
