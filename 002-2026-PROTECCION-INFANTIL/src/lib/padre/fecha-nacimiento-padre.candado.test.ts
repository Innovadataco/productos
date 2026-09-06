/**
 * SPEC-541 (P2) · CANDADO de conducta: la fecha de nacimiento del padre válida es
 * de 18 a 100 años y NO futura. Antes solo se validaba el formato → aceptaba 1900
 * y fechas futuras.
 *
 * Vigila los DOS bordes (18 y 100) y el futuro. Ref FIJA (no `new Date()`, lección
 * SPEC-538) para que los bordes no dependan del reloj.
 *
 * Muere con el defecto: si se quita el rango (solo formato), 1900 y las fechas
 * futuras pasan → los `not.toBeNull()` caen.
 */
import { describe, it, expect } from "vitest";
import { validarFechaNacimientoPadre, EDAD_MIN_PADRE, EDAD_MAX_PADRE } from "./fecha-nacimiento-padre";

const REF = new Date("2026-09-06T12:00:00.000Z");
const ok = (f: string) => validarFechaNacimientoPadre(f, REF);

describe("SPEC-541 · validación de fecha de nacimiento del padre (18–100, sin futuro)", () => {
    it("acepta una edad en el medio del rango", () => {
        expect(ok("1990-05-15")).toBeNull();
    });

    it("borde inferior: exactamente 18 años es válido; 17 (un día antes de cumplir) no", () => {
        expect(ok("2008-09-06")).toBeNull(); // cumple 18 justo hoy
        expect(ok("2008-09-07")).not.toBeNull(); // los cumple mañana → 17
    });

    it("borde superior: exactamente 100 años es válido; 101 no", () => {
        expect(ok("1926-09-06")).toBeNull(); // 100 justo
        expect(ok("1925-09-06")).not.toBeNull(); // 101
    });

    it("rechaza 1900 (demasiado viejo)", () => {
        expect(ok("1900-01-01")).not.toBeNull();
    });

    it("rechaza una fecha futura", () => {
        expect(ok("2027-01-01")).not.toBeNull();
        expect(ok("2099-12-31")).not.toBeNull();
    });

    it("los límites son 18 y 100", () => {
        expect(EDAD_MIN_PADRE).toBe(18);
        expect(EDAD_MAX_PADRE).toBe(100);
    });
});
