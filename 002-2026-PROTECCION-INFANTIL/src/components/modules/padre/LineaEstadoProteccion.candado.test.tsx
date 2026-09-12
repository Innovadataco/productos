/**
 * SPEC-660 · Candado de render de la línea de estado (I-396 · defensa en forma).
 *
 * El caso REAL, no el fácil: con el motor caído, el dato llega HONESTO —
 * `ultimaVerificacionEn` trae el último éxito real, NO recortado (Dev 2 no lo anula:
 * el rector muestra el reloj en degradado)—. La decisión de NO pintar «Revisado hace
 * {X}» en la cara del padre cuando está degradado es de ESTE render. Un candado que
 * solo verifica el caso `null` no vigila el caso real. Muere si alguien pinta el reloj
 * en degradado. Y nunca promete «te avisamos» (I-397); nunca rojo.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LineaEstadoProteccion } from "./LineaEstadoProteccion";

const HACE_UN_RATO = new Date(Date.now() - 60_000).toISOString();

describe("SPEC-660 · línea de estado de protección (render)", () => {
    it("DEGRADADO con un ultimaVerificacionEn REAL: NO pinta el reloj (el caso que importa)", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: false, ultimaVerificacionEn: HACE_UN_RATO }} />,
        );
        const t = container.textContent ?? "";
        expect(t, "en degradado no se muestra el reloj aunque el dato traiga valor").not.toMatch(/Revisado|hace/i);
        expect(t).toContain("Estamos terminando de revisar");
    });

    it("motor VIVO con verificación: muestra «Sin reportes» + el reloj", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: HACE_UN_RATO }} />,
        );
        const t = container.textContent ?? "";
        expect(t).toContain("Sin reportes");
        expect(t).toContain("Vigilando");
        expect(t).toMatch(/Revisado hace/);
    });

    it("motor VIVO sin verificación previa (null): calma sin reloj", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: null }} />,
        );
        const t = container.textContent ?? "";
        expect(t).toContain("Vigilando");
        expect(t).not.toMatch(/Revisado|hace/i);
    });

    it("nunca promete «te avisamos» (I-397) ni pinta rojo, en ningún estado", () => {
        for (const motorVivo of [true, false]) {
            const { container } = render(
                <LineaEstadoProteccion estado={{ motorVivo, ultimaVerificacionEn: HACE_UN_RATO }} />,
            );
            expect(container.textContent ?? "", `motorVivo=${motorVivo}`).not.toMatch(/te avisamos|te avisaremos/i);
            expect(container.innerHTML, `motorVivo=${motorVivo}`).not.toMatch(/rubi|--rubi|\brojo\b|\bred\b|#f00/i);
        }
    });
});
