/**
 * SPEC-143 (D1) → SPEC-560 (D-120) — Tests de la regla del estado del colegio.
 * El estado es SEMÁNTICO (PENDIENTE/ATENDIDO/TRANQUILO); el color lo decide
 * `colorDeEstadoColegio`, y D-120 exige que NUNCA sea rubí (el rubí es solo de la
 * alerta de alto riesgo en su tarjeta, no del hero-resumen).
 */
import { describe, it, expect } from "vitest";
import { resolverEstado, colorDeEstadoColegio, type EstadoColegio } from "./semaforo";

describe("resolverEstado (D-120, semántico)", () => {
    it("PENDIENTE cuando hay al menos una alerta nueva (aunque no haya en 72 h)", () => {
        expect(resolverEstado({ alertasNuevas: 1, alertas72h: 0 })).toBe("PENDIENTE");
        expect(resolverEstado({ alertasNuevas: 3, alertas72h: 0 })).toBe("PENDIENTE");
    });
    it("PENDIENTE gana cuando hay nuevas y también recientes", () => {
        expect(resolverEstado({ alertasNuevas: 1, alertas72h: 5 })).toBe("PENDIENTE");
    });
    it("ATENDIDO cuando no hay nuevas pero sí en las últimas 72 h", () => {
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 1 })).toBe("ATENDIDO");
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 4 })).toBe("ATENDIDO");
    });
    it("TRANQUILO cuando no hay nuevas ni nada en 72 h", () => {
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 0 })).toBe("TRANQUILO");
    });
});

describe("colorDeEstadoColegio (D-120: atención=ámbar, al día=pino, NUNCA rubí)", () => {
    it("PENDIENTE → ámbar (hay que actuar, no es criticidad)", () => {
        expect(colorDeEstadoColegio("PENDIENTE")).toBe("ambar");
    });
    it("ATENDIDO y TRANQUILO → pino (al día)", () => {
        expect(colorDeEstadoColegio("ATENDIDO")).toBe("pino");
        expect(colorDeEstadoColegio("TRANQUILO")).toBe("pino");
    });
    it("ningún estado del colegio se pinta en rubí (D-120)", () => {
        const todos: EstadoColegio[] = ["PENDIENTE", "ATENDIDO", "TRANQUILO"];
        for (const e of todos) expect(colorDeEstadoColegio(e)).not.toBe("rubi");
    });
});
