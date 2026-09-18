/**
 * SPEC-660 + SPEC-716 (Parte A · I-427) · Candado de render de la línea de estado.
 *
 * I-427: la línea afirmaba «Sin reportes» con el motor vivo SIN saber si había reportes, mientras el
 * gráfico pintaba al hijo en ámbar — dos verdades a 30 píxeles. Ahora la línea deriva su texto de
 * `cuentasConReporte` (el MISMO hecho que el ámbar). El candado exige, por CONDUCTA: con motor vivo
 * y ≥1 cuenta reportada, la cadena «Sin reportes» NO puede aparecer (control positivo abajo). Y se
 * conserva I-396: con el motor caído no se afirma calma (ni «Sin reportes», ni reloj, ni «las demás»).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LineaEstadoProteccion } from "./LineaEstadoProteccion";

const HACE_UN_RATO = new Date(Date.now() - 60_000).toISOString();

describe("SPEC-660 · línea de estado de protección (render)", () => {
    it("DEGRADADO con un ultimaVerificacionEn REAL: NO pinta el reloj (el caso que importa)", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: false, ultimaVerificacionEn: HACE_UN_RATO }} cuentasConReporte={0} />,
        );
        const t = container.textContent ?? "";
        expect(t, "en degradado no se muestra el reloj aunque el dato traiga valor").not.toMatch(/Revisado|hace/i);
        expect(t).toContain("Estamos terminando de revisar");
    });

    it("motor VIVO, 0 cuentas con reporte: muestra «Sin reportes» + el reloj", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: HACE_UN_RATO }} cuentasConReporte={0} />,
        );
        const t = container.textContent ?? "";
        expect(t).toContain("Sin reportes");
        expect(t).toContain("Vigilando");
        expect(t).toMatch(/Revisado hace/);
    });

    it("motor VIVO sin verificación previa (null), 0 cuentas: calma sin reloj", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: null }} cuentasConReporte={0} />,
        );
        const t = container.textContent ?? "";
        expect(t).toContain("Vigilando");
        expect(t).not.toMatch(/Revisado|hace/i);
    });

    it("nunca promete «te avisamos» (I-397) ni pinta rojo, en ningún estado", () => {
        for (const motorVivo of [true, false]) {
            for (const cuentas of [0, 2]) {
                const { container } = render(
                    <LineaEstadoProteccion estado={{ motorVivo, ultimaVerificacionEn: HACE_UN_RATO }} cuentasConReporte={cuentas} />,
                );
                expect(container.textContent ?? "", `motorVivo=${motorVivo} cuentas=${cuentas}`).not.toMatch(/te avisamos|te avisaremos/i);
                expect(container.innerHTML, `motorVivo=${motorVivo} cuentas=${cuentas}`).not.toMatch(/rubi|--rubi|\brojo\b|\bred\b|#f00/i);
            }
        }
    });

    // ── SPEC-716 (Parte A · I-427) ─────────────────────────────────────────────────
    it("CANDADO I-427 · motor vivo + ≥1 cuenta con reporte → «necesita tu atención», NUNCA «Sin reportes»", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: HACE_UN_RATO }} cuentasConReporte={1} />,
        );
        const t = container.textContent ?? "";
        expect(t, "con reportes visibles la línea NO puede afirmar «Sin reportes» (I-427)").not.toContain("Sin reportes");
        expect(t).toContain("1 cuenta necesita tu atención");
        expect(t).toContain("Las demás, sin novedad");
    });

    it("singular/plural real: «1 cuenta necesita» vs «2 cuentas necesitan» (nunca «1 cuentas»)", () => {
        const uno = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: null }} cuentasConReporte={1} />,
        ).container.textContent ?? "";
        expect(uno).toContain("1 cuenta necesita tu atención");
        expect(uno).not.toContain("1 cuentas");

        const dos = render(
            <LineaEstadoProteccion estado={{ motorVivo: true, ultimaVerificacionEn: null }} cuentasConReporte={2} />,
        ).container.textContent ?? "";
        expect(dos).toContain("2 cuentas necesitan tu atención");
    });

    it("I-396 · motor CAÍDO manda sobre el conteo: aunque cuentasConReporte≥1, NO afirma nada (ni «necesita», ni «Sin reportes», ni reloj)", () => {
        const { container } = render(
            <LineaEstadoProteccion estado={{ motorVivo: false, ultimaVerificacionEn: HACE_UN_RATO }} cuentasConReporte={3} />,
        );
        const t = container.textContent ?? "";
        expect(t).toContain("Estamos terminando de revisar");
        expect(t).not.toContain("Sin reportes");
        expect(t).not.toMatch(/necesita|necesitan/);
        expect(t).not.toMatch(/Revisado|hace/i);
    });
});
