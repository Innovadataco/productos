/**
 * SPEC-746 · CANDADO de la fuente única del estado EFECTIVO de una cita.
 *
 * Control positivo EN LAS DOS DIRECCIONES (lo pedido por el CEO):
 *  - CONFIRMADA + franja FUTURA → PROXIMA  (prueba que NO está clavada en PASADA);
 *  - CONFIRMADA + franja de AYER → PASADA   (la MENTIRA que 746 mata: prueba que
 *    NO está clavada en PROXIMA y que `CONFIRMADA` crudo nunca se filtra).
 * Ninguna implementación tramposa (siempre-PROXIMA ni siempre-PASADA) pasa ambas.
 *
 * Fallo conservador de `now`/franja: ausente o basura → PASADA, JAMÁS PROXIMA
 * (PROXIMA seguiría mintiendo; el defecto no puede disfrazarse de «todo bien»).
 *
 * «Sin inventar estados»: todo estado que NO sea CONFIRMADA se devuelve tal cual,
 * incluso con franja de ayer (la fase temporal se superpone SOLO a CONFIRMADA).
 * El barrido es EXHAUSTIVO sobre el enum (Object.values) → si el negocio agrega
 * un estado, el candado lo cubre solo.
 *
 * Los límites son EXACTOS (now===inicio, now===fin) para que mutar cualquier
 * comparación temporal (`<`↔`<=`, invertir dirección) ponga el candado ROJO.
 *
 * Puro (sin BD, sin fs): cae al shard de integración por el glob src/** — no toca
 * vitest.unit.includes.ts para no chocar con PRs concurrentes (patrón de 545).
 */
import { describe, it, expect } from "vitest";
import { EstadoSolicitudCita } from "@prisma/client";
import {
    estadoEfectivoDeCita,
    type EstadoEfectivoCita,
} from "@/lib/profesional/cita/estado-efectivo";

// Instante de referencia fijo (determinista). El entorno corre en UTC.
const NOW = new Date("2026-09-29T15:00:00.000Z");

// Franja de AYER (el dato duro del CEO: cita CONFIRMADA con franja pasada).
const AYER_INI = new Date("2026-09-28T14:00:00.000Z");
const AYER_FIN = new Date("2026-09-28T15:00:00.000Z");
// Franja FUTURA.
const MANANA_INI = new Date("2026-09-30T14:00:00.000Z");
const MANANA_FIN = new Date("2026-09-30T15:00:00.000Z");
// Franja EN CURSO (NOW cae dentro: 14:30 ≤ 15:00 < 15:30).
const HOY_INI = new Date("2026-09-29T14:30:00.000Z");
const HOY_FIN = new Date("2026-09-29T15:30:00.000Z");

describe("SPEC-746 · estadoEfectivoDeCita — fuente única del estado efectivo", () => {
    describe("control positivo bidireccional sobre CONFIRMADA", () => {
        it("franja FUTURA → PROXIMA (no clavado en PASADA)", () => {
            expect(estadoEfectivoDeCita("CONFIRMADA", MANANA_INI, MANANA_FIN, NOW)).toBe("PROXIMA");
        });

        it("franja de AYER → PASADA (la mentira que 746 mata; no clavado en PROXIMA)", () => {
            const efectivo = estadoEfectivoDeCita("CONFIRMADA", AYER_INI, AYER_FIN, NOW);
            expect(efectivo).toBe("PASADA");
            // Nunca puede seguir diciendo «confirmada»:
            expect(efectivo).not.toBe("PROXIMA");
        });

        it("franja EN CURSO (inicio ≤ now < fin) → EN_CURSO", () => {
            expect(estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, NOW)).toBe("EN_CURSO");
        });
    });

    describe("límites exactos (mutación de la comparación → rojo)", () => {
        it("now === inicio → EN_CURSO (no PROXIMA: el borde inferior es inclusivo)", () => {
            expect(estadoEfectivoDeCita("CONFIRMADA", NOW, HOY_FIN, NOW)).toBe("EN_CURSO");
        });

        it("now === inicio − 1 ms → PROXIMA", () => {
            const now = new Date(HOY_INI.getTime() - 1);
            expect(estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, now)).toBe("PROXIMA");
        });

        it("now === fin → PASADA (no EN_CURSO: el borde superior es exclusivo)", () => {
            expect(estadoEfectivoDeCita("CONFIRMADA", HOY_INI, NOW, NOW)).toBe("PASADA");
        });

        it("now === fin − 1 ms → EN_CURSO", () => {
            const now = new Date(HOY_FIN.getTime() - 1);
            expect(estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, now)).toBe("EN_CURSO");
        });
    });

    describe("fallo conservador de `now`/franja (→ PASADA, nunca PROXIMA)", () => {
        const casos: Array<[string, EstadoEfectivoCita]> = [];
        const assertPasada = (nombre: string, efectivo: EstadoEfectivoCita) => {
            it(`${nombre} → PASADA (no PROXIMA)`, () => {
                expect(efectivo, `${nombre} debe caer a PASADA`).toBe("PASADA");
                expect(efectivo, `${nombre} JAMÁS a PROXIMA`).not.toBe("PROXIMA");
            });
            casos.push([nombre, efectivo]);
        };

        // El punto clave: si el llamador olvida inyectar `now`, NO usamos reloj de
        // pared (que parecería «bien») — caemos a PASADA (cierra la ventana).
        assertPasada("now undefined", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, undefined));
        assertPasada("now null", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, null));
        assertPasada("now Date inválida", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, new Date("basura")));
        assertPasada("now string vacío", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, ""));
        assertPasada("now NaN", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, HOY_FIN, Number.NaN));
        assertPasada("franjaInicio ausente", estadoEfectivoDeCita("CONFIRMADA", undefined, HOY_FIN, NOW));
        assertPasada("franjaFin basura", estadoEfectivoDeCita("CONFIRMADA", HOY_INI, "no-es-fecha", NOW));
        assertPasada("franja corrupta (inicio > fin)", estadoEfectivoDeCita("CONFIRMADA", HOY_FIN, HOY_INI, NOW));
    });

    describe("passthrough exhaustivo (sin inventar estados que el negocio no tenga)", () => {
        const otros = Object.values(EstadoSolicitudCita).filter((e) => e !== "CONFIRMADA");

        it("cubre TODOS los estados de negocio salvo CONFIRMADA", () => {
            // Si el enum crece, este número obliga a mirar el nuevo estado.
            expect(otros.length).toBe(Object.values(EstadoSolicitudCita).length - 1);
            expect(otros).not.toContain("CONFIRMADA");
        });

        for (const estado of otros) {
            it(`${estado} se devuelve tal cual, aun con franja de AYER (la fase es solo de CONFIRMADA)`, () => {
                // Franja pasada + now válido: un estado no-CONFIRMADA NO se coacciona a PASADA.
                expect(estadoEfectivoDeCita(estado, AYER_INI, AYER_FIN, NOW)).toBe(estado);
                // Y tampoco lo tocan un `now`/franja inválidos (no consulta el tiempo).
                expect(estadoEfectivoDeCita(estado, undefined, undefined, undefined)).toBe(estado);
            });
        }
    });

    describe("CONFIRMADA crudo NUNCA se filtra (imposibilidad, no regla)", () => {
        it("ninguna combinación de entradas devuelve el literal «CONFIRMADA»", () => {
            const franjas: Array<[typeof AYER_INI | null, typeof AYER_FIN | null]> = [
                [AYER_INI, AYER_FIN],
                [MANANA_INI, MANANA_FIN],
                [HOY_INI, HOY_FIN],
                [null, null],
            ];
            const nows = [NOW, undefined, null, new Date("x")] as const;
            for (const [ini, fin] of franjas) {
                for (const now of nows) {
                    expect(estadoEfectivoDeCita("CONFIRMADA", ini, fin, now)).not.toBe("CONFIRMADA");
                }
            }
        });
    });

    describe("tolerancia de formato de entrada (fuente ÚNICA para todo llamador)", () => {
        it("Date, ISO string y epoch ms dan el mismo resultado", () => {
            const conDate = estadoEfectivoDeCita("CONFIRMADA", AYER_INI, AYER_FIN, NOW);
            const conISO = estadoEfectivoDeCita(
                "CONFIRMADA",
                AYER_INI.toISOString(),
                AYER_FIN.toISOString(),
                NOW.toISOString(),
            );
            const conMs = estadoEfectivoDeCita(
                "CONFIRMADA",
                AYER_INI.getTime(),
                AYER_FIN.getTime(),
                NOW.getTime(),
            );
            expect(conDate).toBe("PASADA");
            expect(conISO).toBe(conDate);
            expect(conMs).toBe(conDate);
        });
    });
});
