/**
 * SPEC-660 · Candado de conducta del gráfico de «A quién protejo».
 *
 * Vigila las invariantes de forma (FORMA-SPEC660 + I-396):
 *  1. NUNCA rojo/rubí — el peso lo carga el copy, no el color (SPEC-362).
 *  2. El HUECO DE COBERTURA (activo sin cuentas) es CIELO, no ámbar.
 *  3. NINGÚN número de reportantes sobre un nodo/arco (imposibilidad estructural).
 *  4. ASIMETRÍA I-396 (defensa en forma, en paralelo a SPEC-671 en el dato): con el
 *     motor CAÍDO la AUSENCIA de reportes no es confiable, la PRESENCIA sí. Por eso
 *     el ámbar se CONSERVA aunque el motor esté caído, y solo el verde degrada a
 *     neutro «en revisión». Nunca falsa calma, nunca falsa alarma. Muere si alguien
 *     hace que un hijo reportado se lea «tranquilo» sin motor, o que un no-reportado
 *     sin motor se pinte verde.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GraficoProteccion, derivarEstadoHijo, type HijoGrafico } from "./GraficoProteccion";

const base = (over: Partial<HijoGrafico>): HijoGrafico => ({
    id: "1",
    nombre: "Mateo Restrepo",
    activo: true,
    tieneCuentasActivas: true,
    tieneReportes: false,
    ...over,
});

const HIJOS: HijoGrafico[] = [
    base({ id: "1", nombre: "Mateo Restrepo", tieneReportes: false }), // tranquilo (motor vivo)
    base({ id: "2", nombre: "Lucía Restrepo", tieneCuentasActivas: false }), // sin-cuentas
    base({ id: "3", nombre: "Tomás Restrepo", activo: false }), // en-pausa
];

describe("SPEC-660 · gráfico de protección (conducta)", () => {
    it("NUNCA rojo/rubí en ningún estado (incluye atención y en-revisión)", () => {
        for (const motorVivo of [true, false]) {
            const { container } = render(
                <GraficoProteccion hijos={[...HIJOS, base({ id: "4", tieneReportes: true })]} motorVivo={motorVivo} circuloPersonas={4} />,
            );
            expect(container.innerHTML, `motorVivo=${motorVivo}`).not.toMatch(/rubi|--rubi|\brojo\b|\bred\b|#f00|#ff0000/i);
        }
    });

    it("el hueco de cobertura (sin-cuentas) es CIELO, no ámbar", () => {
        const { container } = render(<GraficoProteccion hijos={[base({ tieneCuentasActivas: false })]} motorVivo={true} circuloPersonas={0} />);
        expect(container.innerHTML).toMatch(/--cielo-rgb/);
        expect(container.innerHTML).not.toMatch(/--ambar-rgb/);
    });

    it("ASIMETRÍA I-396: el ámbar se conserva con el motor caído; solo el verde degrada a neutro", () => {
        const reportado = { activo: true, tieneCuentasActivas: true, tieneReportes: true };
        const limpio = { activo: true, tieneCuentasActivas: true, tieneReportes: false };
        // Presencia = hecho verificado → ámbar con motor vivo Y caído.
        expect(derivarEstadoHijo(reportado, true)).toBe("atencion");
        expect(derivarEstadoHijo(reportado, false), "reportado + motor caído DEBE seguir ámbar, no calma").toBe("atencion");
        // Ausencia = no confiable sin motor → verde solo con motor vivo, si no NEUTRO.
        expect(derivarEstadoHijo(limpio, true)).toBe("tranquilo");
        expect(derivarEstadoHijo(limpio, false), "no-reportado + motor caído NO puede ser «tranquilo»").toBe("en-revision");
    });

    it("con el motor caído, un hijo sin reportes NO dice «tranquilo» (dice «en revisión», neutro)", () => {
        const { container } = render(<GraficoProteccion hijos={[base({ tieneReportes: false })]} motorVivo={false} circuloPersonas={0} />);
        expect(container.textContent).toContain("en revisión");
        expect(container.textContent).not.toContain("tranquilo");
    });

    it("ningún número de reportantes sobre un nodo (solo inicial + nombre + estado)", () => {
        const { container } = render(<GraficoProteccion hijos={[...HIJOS, base({ id: "4", tieneReportes: true })]} motorVivo={true} circuloPersonas={4} />);
        const textos = Array.from(container.querySelectorAll("text")).map((t) => (t.textContent ?? "").trim());
        for (const t of textos) {
            expect(/^\d+$/.test(t), `número suelto sobre un nodo (¿contador de reportantes?): "${t}"`).toBe(false);
        }
    });
});
