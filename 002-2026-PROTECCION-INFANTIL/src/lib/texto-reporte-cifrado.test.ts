/**
 * SPEC-130 (BL-4, O-3): helper de cifrado del texto del reporte.
 * El marcador de purga nunca se cifra; texto plano legado se lee tal cual.
 * SPEC-520 (PA · DoS): el cifrado de ENTRADA es INCONDICIONAL (no se decide por la
 * forma del texto del usuario) y una fila que no descifra se aísla, no tumba la página.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import {
    MARCADOR_TEXTO_PURGADO,
    estaCifradoTextoReporte,
    descifrarTextoReporte,
    cifrarTextoReporte,
    purgaTextoReporte,
} from "./texto-reporte-cifrado";
import { isEncryptedValue } from "./param-encryption";
import { logger } from "./logger";

// Clave SOLO de tests (no productiva); getEncryptionKey la lee de la variable.
beforeAll(() => {
    process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
});

describe("texto-reporte-cifrado (SPEC-130)", () => {
    it("cifra y descifra conservando el contenido íntegro (la evidencia no se altera)", () => {
        const original = "El usuario me pidió fotos por WhatsApp tres veces.";
        const cifrado = cifrarTextoReporte(original);
        expect(cifrado).not.toBe(original);
        expect(isEncryptedValue(cifrado)).toBe(true);
        expect(descifrarTextoReporte(cifrado)).toBe(original);
    });

    it("SPEC-520 (DoS) · un texto de USUARIO con forma `enc:{…}` se CIFRA, no se guarda en claro", () => {
        // El olfateo viejo (`isEncryptedValue(plain)`) guardaba este literal EN CLARO;
        // después toda lectura tronaba dentro del `.map()` de la bandeja → 500 para
        // TODOS los operadores. El formulario es público y anónimo: lo dispara cualquiera.
        const veneno = 'enc:{"iv":"a","tag":"b","v":"c"}';
        const almacenado = cifrarTextoReporte(veneno);
        expect(almacenado, "el texto del usuario NUNCA se guarda tal cual").not.toBe(veneno);
        expect(isEncryptedValue(almacenado)).toBe(true);
        expect(descifrarTextoReporte(almacenado), "round-trip conserva el contenido del denunciante").toBe(veneno);
    });

    it("SPEC-520 (DoS) · una fila `enc:{…}` que no descifra NO tumba la lectura, pero se LOGUEA (no silenciosa)", () => {
        // Fila pre-fix guardada en claro con SOLO la forma `enc:{…}` (iv/tag/v no son
        // criptografía válida). Antes `decryptParameter` tiraba y una fila mataba la
        // página entera; ahora se aísla por fila: devuelve el valor, no propaga el throw.
        const venenoEnClaro = 'enc:{"iv":"a","tag":"b","v":"c"}';
        const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
        expect(() => descifrarTextoReporte(venenoEnClaro, { reporteId: "rep-123" })).not.toThrow();
        expect(descifrarTextoReporte(venenoEnClaro, { reporteId: "rep-123" })).toBe(venenoEnClaro);
        // NO silenciosa: se registró CON el id de la fila…
        expect(spy).toHaveBeenCalled();
        const serializado = JSON.stringify(spy.mock.calls.at(-1) ?? []);
        expect(serializado, "el log debe llevar el id de la fila").toContain("rep-123");
        // …y NUNCA el contenido/valor del sobre (si no, cambiaríamos un 500 por corrupción callada).
        expect(serializado, "el log NUNCA lleva el contenido ni el valor").not.toContain(venenoEnClaro);
        spy.mockRestore();
    });

    it("lectura idempotente: texto plano legado se devuelve tal cual (ventana de migración)", () => {
        expect(descifrarTextoReporte("texto en claro histórico")).toBe("texto en claro histórico");
        expect(estaCifradoTextoReporte("texto en claro histórico")).toBe(false);
        expect(estaCifradoTextoReporte(cifrarTextoReporte("x"))).toBe(true);
    });

    it("el marcador de purga no se cifra ni se descifra (D4/O-2)", () => {
        expect(purgaTextoReporte()).toBe(MARCADOR_TEXTO_PURGADO);
        expect(cifrarTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(MARCADOR_TEXTO_PURGADO);
        expect(descifrarTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(MARCADOR_TEXTO_PURGADO);
        expect(estaCifradoTextoReporte(MARCADOR_TEXTO_PURGADO)).toBe(false);
    });

    it("nulos/vacíos no rompen", () => {
        expect(descifrarTextoReporte(null)).toBe("");
        expect(descifrarTextoReporte(undefined)).toBe("");
        expect(estaCifradoTextoReporte(null)).toBe(false);
    });
});
