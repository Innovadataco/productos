/**
 * SPEC-369 · candados del poblador demo v2 (lógica pura, sin BD).
 */
import { describe, it, expect } from "vitest";
import { rng } from "./_common";
import { DEMO } from "./_common";
import {
    DEMO2,
    PESOS_CATEGORIA,
    PESOS_ANIO,
    RELATOS,
    CIUDADES_DEMO2,
    elegirPonderado,
    fechaRepartida,
    id2,
} from "./_common-v2";

describe("demo v2 · reversibilidad por marca", () => {
    it("los prefijos del v1 y del v2 son DISJUNTOS en las dos direcciones", () => {
        // Es la propiedad que hace seguro borrar: el borrador de cada versión no
        // puede alcanzar a la otra. "demo2-" no empieza por "demo-" porque el
        // quinto carácter es `2`, no `-`.
        expect(id2.reporte(1).startsWith(DEMO.prefix)).toBe(false);
        expect(`${DEMO.prefix}r-00001`.startsWith(DEMO2.prefix)).toBe(false);
    });

    it("los NIT del v2 empiezan donde termina el v1 (no se pisan)", () => {
        expect(DEMO2.nitInicio).toBeGreaterThan(DEMO.nitFin);
    });

    it("la marca de correo del v2 es propia", () => {
        expect(DEMO2.emailMarca).not.toBe(DEMO.emailMarca);
        expect(DEMO2.emailMarca.startsWith(DEMO.emailMarca)).toBe(false);
    });

    it("los ids son deterministas (la corrida es idempotente)", () => {
        expect(id2.reporte(7)).toBe(id2.reporte(7));
        expect(id2.reporte(7)).not.toBe(id2.reporte(8));
        expect(id2.clasificacion(id2.reporte(7))).toBe(id2.clasificacion(id2.reporte(7)));
    });
});

describe("demo v2 · fechas repartidas (pedido de Jelkin: 2024, 2025 y 2026)", () => {
    const AHORA = new Date("2026-09-02T18:00:00Z");

    it("nunca genera fechas futuras", () => {
        const r = rng(12345);
        for (let i = 0; i < 500; i++) {
            expect(fechaRepartida(r, AHORA).getTime()).toBeLessThanOrEqual(AHORA.getTime());
        }
    });

    it("siempre deja la hora en punto (coherente con G20)", () => {
        const r = rng(999);
        for (let i = 0; i < 100; i++) {
            const f = fechaRepartida(r, AHORA);
            expect(f.getUTCMinutes()).toBe(0);
            expect(f.getUTCSeconds()).toBe(0);
        }
    });

    it("hay densidad en LOS TRES años, no solo en el último", () => {
        const r = rng(2026);
        const porAnio = new Map<number, number>();
        for (let i = 0; i < 2000; i++) {
            const a = fechaRepartida(r, AHORA).getUTCFullYear();
            porAnio.set(a, (porAnio.get(a) ?? 0) + 1);
        }
        for (const { anio } of PESOS_ANIO) {
            // Cada tramo con presencia real (no dos reportes sueltos).
            expect(porAnio.get(anio) ?? 0).toBeGreaterThan(200);
        }
    });
});

describe("demo v2 · variedad para que el clasificador vea cosas distintas", () => {
    it("cada categoría tiene sus propios relatos, y no se repiten entre categorías", () => {
        const vistos = new Set<string>();
        for (const [, textos] of Object.entries(RELATOS)) {
            expect(textos.length).toBeGreaterThanOrEqual(3);
            for (const t of textos) {
                expect(vistos.has(t), `relato repetido entre categorías: ${t}`).toBe(false);
                vistos.add(t);
            }
        }
    });

    it("la mezcla NO es uniforme: las sensibles pesan más que el spam", () => {
        const peso = (c: string) => PESOS_CATEGORIA.find((p) => p.categoria === c)?.peso ?? 0;
        expect(peso("SOLICITUD_MATERIAL")).toBeGreaterThan(peso("SPAM"));
        expect(peso("COMPARTIMIENTO_SEXUAL")).toBeGreaterThan(peso("SPAM"));
        expect(peso("SOLICITUD_ENCUENTRO")).toBeGreaterThan(peso("DOXING"));
    });

    it("el reparto ponderado respeta los pesos (las sensibles salen más)", () => {
        const r = rng(77);
        const conteo = new Map<string, number>();
        for (let i = 0; i < 4000; i++) {
            const { categoria } = elegirPonderado(r, PESOS_CATEGORIA);
            conteo.set(categoria, (conteo.get(categoria) ?? 0) + 1);
        }
        expect(conteo.get("SOLICITUD_MATERIAL") ?? 0).toBeGreaterThan(conteo.get("SPAM") ?? 0);
        // Y todas aparecen: nada queda en cero.
        for (const { categoria } of PESOS_CATEGORIA) {
            expect(conteo.get(categoria) ?? 0, `${categoria} nunca salió`).toBeGreaterThan(0);
        }
    });

    it("hay ciudades de VARIOS países, no solo Colombia", () => {
        const paises = new Set(CIUDADES_DEMO2.map((c) => c.split(":")[0]));
        expect(paises.size).toBeGreaterThanOrEqual(5);
        expect(paises.has("CO")).toBe(true);
    });
});
