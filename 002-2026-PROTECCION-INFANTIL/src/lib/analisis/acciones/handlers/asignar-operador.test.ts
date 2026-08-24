/**
 * SPEC-226 (002-PI-mega-cola, FR-006/FR-016): tests unitarios de la selección
 * pura `menor_carga` del handler `asignar_operador` (sin BD): menor número de
 * asignaciones vivas; empate → asignación más antigua; desempate → alta más
 * antigua; sin operadores → null.
 */
import { describe, it, expect } from "vitest";
import { seleccionarOperadorMenorCarga } from "./asignar-operador";

const T0 = new Date("2026-08-01T00:00:00Z");
const T1 = new Date("2026-08-10T00:00:00Z");
const T2 = new Date("2026-08-20T00:00:00Z");

const OPS = [
    { id: "op-a", creadoEn: T0 },
    { id: "op-b", creadoEn: T1 },
    { id: "op-c", creadoEn: T2 },
];

describe("seleccionarOperadorMenorCarga", () => {
    it("sin operadores activos devuelve null", () => {
        expect(seleccionarOperadorMenorCarga([], [])).toBeNull();
    });

    it("sin asignaciones vivas: gana el de alta más antigua", () => {
        expect(seleccionarOperadorMenorCarga(OPS, [])).toBe("op-a");
    });

    it("gana el de menor carga aunque sea el más nuevo", () => {
        const asignaciones = [
            { operadorId: "op-a", ejecutadaEn: T1 },
            { operadorId: "op-b", ejecutadaEn: T2 },
        ];
        expect(seleccionarOperadorMenorCarga(OPS, asignaciones)).toBe("op-c");
    });

    it("empate de carga: gana el de asignación más antigua", () => {
        const asignaciones = [
            { operadorId: "op-a", ejecutadaEn: T2 }, // asignación reciente
            { operadorId: "op-b", ejecutadaEn: T1 }, // asignación más antigua
        ];
        // op-a y op-b tienen carga 1, op-c carga 0 → op-c gana por carga.
        expect(seleccionarOperadorMenorCarga(OPS, asignaciones)).toBe("op-c");
        // Con op-c fuera, entre op-a y op-b gana op-b (su última asignación es más antigua).
        expect(seleccionarOperadorMenorCarga(OPS.slice(0, 2), asignaciones)).toBe("op-b");
    });

    it("la carga cuenta múltiples asignaciones del mismo operador", () => {
        const asignaciones = [
            { operadorId: "op-c", ejecutadaEn: T1 },
            { operadorId: "op-c", ejecutadaEn: T2 },
            { operadorId: "op-a", ejecutadaEn: T2 },
        ];
        // op-c carga 2, op-a carga 1, op-b carga 0 → op-b.
        expect(seleccionarOperadorMenorCarga(OPS, asignaciones)).toBe("op-b");
    });
});
