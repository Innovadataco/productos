/**
 * SPEC-309 (A-50): tests unitarios de la sugerencia proactiva del home.
 */
import { describe, it, expect } from "vitest";
import { calcularSugerenciaHome, contarPorColor } from "./home-sugerencia";

describe("calcularSugerenciaHome", () => {
    it("prioriza renovación cuando está en período de gracia", () => {
        const sugerencia = calcularSugerenciaHome({
            totalContactos: 3,
            contactosRojo: 1,
            contactosAmbar: 0,
            enPeriodoGracia: true,
            nombrePadre: null,
        });
        expect(sugerencia.prioridad).toBe("alta");
        expect(sugerencia.texto).toContain("período de gracia");
        expect(sugerencia.accionHref).toBe("/dashboard/padre/suscripcion");
    });

    it("recomienda revisar expedientes cuando hay contactos en rojo", () => {
        const sugerencia = calcularSugerenciaHome({
            totalContactos: 3,
            contactosRojo: 2,
            contactosAmbar: 1,
            enPeriodoGracia: false,
            nombrePadre: null,
        });
        expect(sugerencia.prioridad).toBe("alta");
        expect(sugerencia.accionHref).toBe("/dashboard/padre/expedientes");
    });

    it("sugiere ver el círculo cuando hay contactos en ámbar", () => {
        const sugerencia = calcularSugerenciaHome({
            totalContactos: 3,
            contactosRojo: 0,
            contactosAmbar: 1,
            enPeriodoGracia: false,
            nombrePadre: null,
        });
        expect(sugerencia.prioridad).toBe("media");
        expect(sugerencia.accionHref).toBe("/dashboard/padre/circulo-confianza");
    });

    it("invita a agregar contacto cuando no hay contactos", () => {
        const sugerencia = calcularSugerenciaHome({
            totalContactos: 0,
            contactosRojo: 0,
            contactosAmbar: 0,
            enPeriodoGracia: false,
            nombrePadre: null,
        });
        expect(sugerencia.prioridad).toBe("baja");
        expect(sugerencia.accionHref).toBe("/dashboard/padre/circulo-confianza");
    });

    it("muestra estado tranquilo cuando todo está verde", () => {
        const sugerencia = calcularSugerenciaHome({
            totalContactos: 2,
            contactosRojo: 0,
            contactosAmbar: 0,
            enPeriodoGracia: false,
            nombrePadre: null,
        });
        expect(sugerencia.texto).toContain("tranquilo");
    });
});

describe("contarPorColor", () => {
    it("cuenta correctamente por color", () => {
        const semaforo = [
            { color: "ROJO" as const },
            { color: "ROJO" as const },
            { color: "AMBAR" as const },
            { color: "VERDE" as const },
        ];
        expect(contarPorColor(semaforo)).toEqual({ rojo: 2, ambar: 1, verde: 1 });
    });
});
