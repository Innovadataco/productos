/**
 * SPEC-143 (D1) — Tests de la regla del semáforo: rubí = ≥1 nueva · ámbar = ≥1 en
 * 72 h (sin nuevas) · pino = el resto.
 */
import { describe, it, expect } from "vitest";
import { resolverEstado } from "./semaforo";

describe("resolverEstado (semáforo D1)", () => {
    it("rubí cuando hay al menos una alerta nueva, aunque no haya en 72 h", () => {
        expect(resolverEstado({ alertasNuevas: 1, alertas72h: 0 })).toBe("rubi");
        expect(resolverEstado({ alertasNuevas: 3, alertas72h: 0 })).toBe("rubi");
    });

    it("rubí gana sobre ámbar cuando hay nuevas y también recientes", () => {
        expect(resolverEstado({ alertasNuevas: 1, alertas72h: 5 })).toBe("rubi");
    });

    it("ámbar cuando no hay nuevas pero sí alertas en las últimas 72 horas", () => {
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 1 })).toBe("ambar");
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 4 })).toBe("ambar");
    });

    it("pino cuando no hay nuevas ni nada en 72 horas", () => {
        expect(resolverEstado({ alertasNuevas: 0, alertas72h: 0 })).toBe("pino");
    });
});
