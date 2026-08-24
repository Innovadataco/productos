/**
 * SPEC-236 (002-PI-mega-cola): tests unitarios de la whitelist de transiciones
 * (FR-001, FR-010, FR-011). No tocan base de datos.
 */
import { describe, it, expect } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { TRANSICIONES, buscarTransicion, EVENTOS_EXPEDIENTE } from "./transiciones";

describe("whitelist de transiciones (SPEC-236)", () => {
    it("declara las transiciones permitidas por estado", () => {
        expect(TRANSICIONES.get(EstadoExpediente.ACTIVO)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.CONSOLIDANDO,
            EstadoExpediente.CERRADO,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.CONSOLIDANDO)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.PENDIENTE_COMITE,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.PENDIENTE_COMITE)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.EN_APROBACION_PADRE,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.EN_APROBACION_PADRE)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.EN_ACLARACION,
            EstadoExpediente.CERRADO,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.EN_ACLARACION)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.EN_APROBACION_PADRE,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.CERRADO)?.map((t) => t.destino)).toEqual([
            EstadoExpediente.ESCALADO,
        ]);
        expect(TRANSICIONES.get(EstadoExpediente.ESCALADO)).toBeUndefined();
    });

    it("cada transición declara guard, nota y evento", () => {
        for (const [estado, defs] of TRANSICIONES) {
            for (const def of defs) {
                expect(typeof def.guard, `${estado}→${def.destino} guard`).toBe("function");
                expect(def.nota.length, `${estado}→${def.destino} nota`).toBeGreaterThan(0);
                expect(Object.values(EVENTOS_EXPEDIENTE), `${estado}→${def.destino} evento`).toContain(def.evento);
            }
        }
    });

    it("buscarTransicion resuelve pares válidos y rechaza inválidos", () => {
        expect(buscarTransicion(EstadoExpediente.ACTIVO, EstadoExpediente.CONSOLIDANDO)).toBeDefined();
        expect(buscarTransicion(EstadoExpediente.ACTIVO, EstadoExpediente.EN_APROBACION_PADRE)).toBeUndefined();
        expect(buscarTransicion(EstadoExpediente.PENDIENTE_COMITE, EstadoExpediente.CERRADO)).toBeUndefined();
        expect(buscarTransicion(EstadoExpediente.ESCALADO, EstadoExpediente.ACTIVO)).toBeUndefined();
    });

    it("CERRADO solo transita a ESCALADO (FR-010/FR-011)", () => {
        const destinos = TRANSICIONES.get(EstadoExpediente.CERRADO)?.map((t) => t.destino) ?? [];
        expect(destinos).toEqual([EstadoExpediente.ESCALADO]);
        // Y ningún otro estado puede llegar a ESCALADO en v1.
        for (const [estado, defs] of TRANSICIONES) {
            if (estado === EstadoExpediente.CERRADO) continue;
            expect(defs.map((t) => t.destino), `${estado} no debe llegar a ESCALADO`).not.toContain(
                EstadoExpediente.ESCALADO
            );
        }
    });
});
