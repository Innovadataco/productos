/**
 * CANDADO · SPEC-891 — corrector de `admin.expediente.etapas` (PII gated).
 *
 * Control positivo: un valor con `contienePii`/`piiDetectada` en `campos` (como el vivo de prod) queda
 * gateado. Idempotente: re-aplicar no cambia nada (no-op). NO destructivo: otras etapas y los demás campos
 * de `anonimizacion` quedan intactos. Si alguien rompe el movimiento, o lo vuelve destructivo (p. ej. pisa
 * el valor entero / pierde etapas), el candado se enciende.
 */
import { describe, it, expect } from "vitest";
import { gatearPiiAnonimizacion } from "./corregir-pii-gated-expediente";

/** Forma del valor VIVO en prod (verificado por el CEO): PII en `campos` (ungated). */
function etapasProd() {
    return [
        { orden: 7, fase: "C", clave: "clasificacion", nombre: "Clasificación", icono: "brain", capa: 1, gated: false,
            campos: ["categoria", "confianza"], camposGated: ["rawResponse"] },
        { orden: 8, fase: "D", faseNombre: "Cierre", clave: "anonimizacion", nombre: "Anonimización PII", icono: "mask", capa: 1, gated: false,
            campos: ["contienePii", "piiDetectada", "anonimizacionValidadaPorId", "anonimizacionValidadaEn"],
            camposGated: ["textoOriginal"] },
        { orden: 9, fase: "D", clave: "decision", nombre: "Decisión", icono: "gavel", capa: 2, gated: false,
            campos: ["transiciones"] },
    ];
}

const anon = (etapas: unknown) =>
    (etapas as Array<Record<string, unknown>>).find((e) => e.clave === "anonimizacion")!;

describe("SPEC-891 · corrector PII gated (admin.expediente.etapas)", () => {
    it("control positivo: mueve contienePii/piiDetectada de campos → camposGated (anonimizacion)", () => {
        const { valor, cambiado } = gatearPiiAnonimizacion(etapasProd());
        expect(cambiado, "detecta y corrige el valor vivo de prod").toBe(true);
        const a = anon(valor);
        expect(a.campos).toEqual(["anonimizacionValidadaPorId", "anonimizacionValidadaEn"]);
        expect(a.camposGated).toEqual(["textoOriginal", "contienePii", "piiDetectada"]);
    });

    it("idempotente: re-aplicar sobre el resultado es no-op (exit 0, sin cambios)", () => {
        const primera = gatearPiiAnonimizacion(etapasProd());
        const segunda = gatearPiiAnonimizacion(primera.valor);
        expect(segunda.cambiado, "ya-gated → no-op").toBe(false);
        expect(segunda.valor).toEqual(primera.valor);
    });

    it("ya-gated de fábrica (seed/CI): no-op", () => {
        const yaGated = [
            { orden: 8, clave: "anonimizacion", campos: ["anonimizacionValidadaPorId", "anonimizacionValidadaEn"],
                camposGated: ["textoOriginal", "contienePii", "piiDetectada"] },
        ];
        const { cambiado, valor } = gatearPiiAnonimizacion(yaGated);
        expect(cambiado).toBe(false);
        expect(valor).toEqual(yaGated);
    });

    it("NO destructivo: otras etapas y los demás campos de anonimizacion quedan intactos", () => {
        const entrada = etapasProd();
        const { valor } = gatearPiiAnonimizacion(entrada);
        const arr = valor as Array<Record<string, unknown>>;
        // Etapas vecinas idénticas.
        expect(arr.find((e) => e.clave === "clasificacion")).toEqual(entrada[0]);
        expect(arr.find((e) => e.clave === "decision")).toEqual(entrada[2]);
        // La anonimizacion conserva todos sus OTROS campos (orden, fase, icono, nombre, gated…).
        const a = anon(valor);
        expect({ orden: a.orden, fase: a.fase, faseNombre: a.faseNombre, clave: a.clave, nombre: a.nombre, icono: a.icono, capa: a.capa, gated: a.gated })
            .toEqual({ orden: 8, fase: "D", faseNombre: "Cierre", clave: "anonimizacion", nombre: "Anonimización PII", icono: "mask", capa: 1, gated: false });
        expect(arr.length).toBe(3);
    });

    it("parcial: si solo uno está en campos, mueve solo ese (sin inventar el otro)", () => {
        const { valor, cambiado } = gatearPiiAnonimizacion([
            { clave: "anonimizacion", campos: ["contienePii", "anonimizacionValidadaEn"], camposGated: ["textoOriginal"] },
        ]);
        expect(cambiado).toBe(true);
        const a = anon(valor);
        expect(a.campos).toEqual(["anonimizacionValidadaEn"]);
        expect(a.camposGated).toEqual(["textoOriginal", "contienePii"]);
    });

    it("no revienta con valores inesperados (no-array)", () => {
        expect(gatearPiiAnonimizacion(null)).toEqual({ valor: null, cambiado: false });
        expect(gatearPiiAnonimizacion({ foo: 1 })).toEqual({ valor: { foo: 1 }, cambiado: false });
    });
});
