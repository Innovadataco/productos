/**
 * CANDADO · SPEC-793 — el enlace de la sesión SOLO puede ser de un proveedor de la ALLOWLIST.
 *
 * Vigila el MECANISMO, no el CONTENIDO de la lista (lo más importante, veredicto CEO): prueba con
 * proveedores de PRUEBA, no con los reales — así, el día que Jelkin apruebe o quite un proveedor, este
 * candado NO se pone rojo por eso. Si se rompiera al cambiar la lista, vigilaría lo equivocado.
 *
 * Dos invariantes duras:
 *  1. Control positivo en las DOS direcciones: un host de proveedor APROBADO entra; cualquier otro se
 *     rechaza con motivo. Mutación (quitar el chequeo de allowlist) → el caso «otro dominio» pasaría → rojo.
 *  2. El PARECIDO no alcanza: un dominio que CONTIENE el nombre de un aprobado sin serlo
 *     (`meet.google.com.atacante.co`) se RECHAZA. Un match por «contiene» acá es un agujero, no un control.
 *
 * Unit puro (sin BD).
 */
import { describe, it, expect } from "vitest";
import {
    validarEnlaceReunion,
    esProveedorAprobado,
    hostPerteneceADominio,
    PROVEEDORES_APROBADOS,
    type ProveedorEnlace,
} from "./enlace-validacion";

// Proveedores de PRUEBA — el candado NO toca la lista real (content-independent).
const PROVEEDORES_PRUEBA: readonly ProveedorEnlace[] = [
    { nombre: "Aprobado de prueba", dominios: ["sala-aprobada.test"], porque: "fixture", aprobado: true },
    { nombre: "Pendiente de prueba", dominios: ["sala-pendiente.test"], porque: "fixture", aprobado: false },
];

describe("SPEC-793 · el enlace solo puede ser de un proveedor APROBADO (mecanismo, no contenido)", () => {
    it("control positivo · DOS direcciones: aprobado entra, cualquier otro se rechaza con motivo", () => {
        const ok = validarEnlaceReunion("https://sala-aprobada.test/x-y-z", PROVEEDORES_PRUEBA);
        expect(ok.ok).toBe(true);

        const no = validarEnlaceReunion("https://otro-proveedor.test/sala", PROVEEDORES_PRUEBA);
        expect(no.ok).toBe(false);
        if (!no.ok) expect(no.razon).toMatch(/proveedor/i);
    });

    it("un subdominio propio del aprobado entra; el host exacto también", () => {
        expect(validarEnlaceReunion("https://us02.sala-aprobada.test/x", PROVEEDORES_PRUEBA).ok).toBe(true);
        expect(validarEnlaceReunion("https://sala-aprobada.test/x", PROVEEDORES_PRUEBA).ok).toBe(true);
    });

    it("un proveedor PENDIENTE (aprobado:false) NO cuenta — hasta que Jelkin lo apruebe, no pasa", () => {
        expect(validarEnlaceReunion("https://sala-pendiente.test/x", PROVEEDORES_PRUEBA).ok).toBe(false);
    });

    it("el PARECIDO no alcanza: `sala-aprobada.test.atacante.co` se RECHAZA (no es «contiene»)", () => {
        expect(validarEnlaceReunion("https://sala-aprobada.test.atacante.co/x", PROVEEDORES_PRUEBA).ok).toBe(false);
        // Y con el ejemplo textual del CEO, contra el dominio pasado explícito (independiente de la lista):
        expect(hostPerteneceADominio("meet.google.com.atacante.co", "meet.google.com")).toBe(false);
        expect(hostPerteneceADominio("meet.google.com", "meet.google.com")).toBe(true); // exacto
        expect(hostPerteneceADominio("us02.meet.google.com", "meet.google.com")).toBe(true); // subdominio
    });

    it("sigue rechazando lo de SPEC-750: no-https, HTML, protocolos raros, vacío", () => {
        expect(validarEnlaceReunion("http://sala-aprobada.test/x", PROVEEDORES_PRUEBA).ok).toBe(false);
        expect(validarEnlaceReunion("https://sala-aprobada.test/<b>", PROVEEDORES_PRUEBA).ok).toBe(false);
        expect(validarEnlaceReunion("javascript:alert(1)", PROVEEDORES_PRUEBA).ok).toBe(false);
        expect(validarEnlaceReunion("   ", PROVEEDORES_PRUEBA).ok).toBe(false);
    });

    it("esProveedorAprobado sin lista aprobada rechaza todo (fail-closed)", () => {
        expect(esProveedorAprobado("sala-aprobada.test", [])).toBe(false);
        expect(esProveedorAprobado("sala-pendiente.test", PROVEEDORES_PRUEBA)).toBe(false);
    });
});

describe("SPEC-793 · forma de la lista REAL (content-independent: no fija QUÉ proveedores, solo que estén bien formados)", () => {
    it("cada entrada lleva su POR QUÉ y al menos un dominio (una lista sin razones se copia sin pensar)", () => {
        for (const p of PROVEEDORES_APROBADOS) {
            expect(p.porque.trim().length, `entrada sin porqué: ${p.nombre}`).toBeGreaterThan(20);
            expect(p.dominios.length, `entrada sin dominios: ${p.nombre}`).toBeGreaterThan(0);
            for (const d of p.dominios) expect(d.includes("."), `dominio inválido en ${p.nombre}: ${d}`).toBe(true);
        }
        // NO se afirma cuántos hay ni cuáles ni su `aprobado`: eso es decisión de Jelkin y cambia sin romper esto.
    });
});
