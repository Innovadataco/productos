/**
 * CANDADO · SPEC-784 (C-1) — «pendiente» se DERIVA y la regla es una sola.
 *
 * Vigila el NÚCLEO PURO `esEncuestaPendientePara`: qué estado efectivo pide encuesta y que una fila ya
 * respondida la apaga. Control positivo por CONSTRUCCIÓN — recorre TODO el espacio de estados efectivos
 * y fija el veredicto de cada uno, así que agregar o quitar un estado del conjunto rompe el test.
 *
 * Pin explícito de D-2 (veredicto CEO): `NO_ASISTIO_PADRE`/`NO_ASISTIO_PROFESIONAL` SÍ piden encuesta —
 * son la afirmación de una parte, no un hecho medido (SPEC-750), y el otro lado necesita el canal para
 * contradecir (NO_PRESTACION_DICHA_PROFESIONAL de 753). Si alguien los «optimiza» fuera del conjunto,
 * este candado cae. Unit puro (sin BD).
 */
import { describe, it, expect } from "vitest";
import type { EstadoEfectivoCita } from "./estado-efectivo";
import {
    ESTADOS_QUE_PIDEN_ENCUESTA,
    esEncuestaPendientePara,
    esEstadoQuePideEncuesta,
    origenParaRol,
} from "./encuesta-pendiente";

// TODO el espacio de `EstadoEfectivoCita`: fase temporal (de una CONFIRMADA) + los estados de negocio
// que NO son CONFIRMADA (passthrough de `estadoEfectivoDeCita`). Es exhaustivo a propósito: el
// `satisfies` obliga a que cada valor sea un estado efectivo real, y el mapa de abajo los cubre todos.
const VEREDICTO_POR_ESTADO = {
    // Fase temporal de una cita CONFIRMADA:
    PROXIMA: false, // la cita no ha llegado
    EN_CURSO: false, // está ocurriendo
    PASADA: true, // llegó y terminó → se auto-reporta qué pasó
    // Estados de negocio (passthrough):
    PAGADA_PENDIENTE: false, // aún no es una cita en pie
    SIN_CONFIRMAR: false, // idem
    CUMPLIDA: true, // sesión dada → encuesta
    NO_ASISTIO_PADRE: true, // D-2: afirmación de parte, el otro lado debe poder contradecir
    NO_ASISTIO_PROFESIONAL: true, // D-2: idem
    VENCIDA_SIN_RESPUESTA: false, // murió sin sesión que reportar
    REEMBOLSADA: false, // idem
    REPROGRAMADA: false, // terminal; la nueva fila (cita) llevará su propia encuesta
} as const satisfies Record<EstadoEfectivoCita, boolean>;

describe("SPEC-784 · C-1 · la derivación de «encuesta pendiente»", () => {
    it("el conjunto que pide encuesta es EXACTAMENTE {PASADA, CUMPLIDA, NO_ASISTIO_PADRE, NO_ASISTIO_PROFESIONAL}", () => {
        expect([...ESTADOS_QUE_PIDEN_ENCUESTA].sort()).toEqual(
            ["CUMPLIDA", "NO_ASISTIO_PADRE", "NO_ASISTIO_PROFESIONAL", "PASADA"],
        );
    });

    it("recorre TODO el espacio de estados efectivos y fija el veredicto de cada uno (control positivo)", () => {
        for (const [estado, esperado] of Object.entries(VEREDICTO_POR_ESTADO) as [EstadoEfectivoCita, boolean][]) {
            expect(esEstadoQuePideEncuesta(estado), `esEstadoQuePideEncuesta(${estado})`).toBe(esperado);
            // Sin responder aún, el veredicto es el del estado.
            expect(esEncuestaPendientePara(estado, false), `pendiente(${estado}, no respondida)`).toBe(esperado);
        }
    });

    it("una fila ya respondida por ese lado APAGA la pendencia, aun en un estado que la pediría", () => {
        for (const [estado, esperado] of Object.entries(VEREDICTO_POR_ESTADO) as [EstadoEfectivoCita, boolean][]) {
            if (!esperado) continue; // solo importa donde SÍ pediría
            expect(esEncuestaPendientePara(estado, true), `pendiente(${estado}, YA respondida)`).toBe(false);
        }
    });

    it("D-2 explícito: NO_ASISTIO_* piden encuesta (no se excluyen por «ya es transición»)", () => {
        expect(esEncuestaPendientePara("NO_ASISTIO_PADRE", false)).toBe(true);
        expect(esEncuestaPendientePara("NO_ASISTIO_PROFESIONAL", false)).toBe(true);
    });

    it("origenParaRol: PARENT→PADRE, PROFESIONAL→PROFESIONAL, el resto no responde encuesta de cita", () => {
        expect(origenParaRol("PARENT")).toBe("PADRE");
        expect(origenParaRol("PROFESIONAL")).toBe("PROFESIONAL");
        expect(origenParaRol("ADMIN")).toBeNull();
        expect(origenParaRol("OPERADOR")).toBeNull();
        expect(origenParaRol("VERIFICADOR")).toBeNull();
        expect(origenParaRol("SCHOOL_ADMIN")).toBeNull();
    });
});
