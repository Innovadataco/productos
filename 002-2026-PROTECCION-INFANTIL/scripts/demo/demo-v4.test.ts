/**
 * SPEC-382 · candados del poblador demo v4 (lógica pura, sin BD).
 */
import { describe, it, expect } from "vitest";
import { rng } from "./_common";
import { DEMO } from "./_common";
import { DEMO2, PESOS_CATEGORIA, RELATOS } from "./_common-v2";
import { DEMO3 } from "./_common-v3";
import {
    DEMO4,
    id4,
    CIUDADES_DEMO4,
    PAISES_DEMO4,
    PESOS_ANIO_V4,
    fechaRepartidaV4,
} from "./_common-v4";

describe("demo v4 · reversibilidad por marca", () => {
    it("prefijo v4 DISJUNTO de v1, v2 y v3 (en ambas direcciones)", () => {
        // La propiedad que hace seguro borrar. Ninguno es prefijo del otro.
        for (const otro of [DEMO.prefix, DEMO2.prefix, DEMO3.prefix]) {
            expect(DEMO4.prefix.startsWith(otro), `v4 "${DEMO4.prefix}" no debe empezar por "${otro}"`).toBe(false);
            expect(otro.startsWith(DEMO4.prefix), `"${otro}" no debe empezar por v4 "${DEMO4.prefix}"`).toBe(false);
        }
        // Ni el id concreto viola: demo4-r-00001 no matchea demo-, demo2-, demo3-.
        const idV4 = id4.reporte(1);
        expect(idV4.startsWith(DEMO.prefix)).toBe(false);
        expect(idV4.startsWith(DEMO2.prefix)).toBe(false);
        expect(idV4.startsWith(DEMO3.prefix)).toBe(false);
    });

    it("marca de correo v4 es propia", () => {
        for (const otra of [DEMO.emailMarca, DEMO2.emailMarca]) {
            expect(DEMO4.emailMarca).not.toBe(otra);
            expect(DEMO4.emailMarca.startsWith(otra)).toBe(false);
        }
    });

    it("ids deterministas (idempotente)", () => {
        expect(id4.reporte(7)).toBe(id4.reporte(7));
        expect(id4.reporte(7)).not.toBe(id4.reporte(8));
        expect(id4.clasificacion(id4.reporte(7))).toBe(id4.clasificacion(id4.reporte(7)));
    });
});

describe("demo v4 · fechas repartidas (Jelkin: 2024, 2025 y 2026)", () => {
    const AHORA = new Date("2026-09-03T12:00:00Z");

    it("nunca genera fechas futuras", () => {
        const r = rng(12345);
        for (let i = 0; i < 1000; i++) {
            expect(fechaRepartidaV4(r, AHORA).getTime()).toBeLessThanOrEqual(AHORA.getTime());
        }
    });

    it("nunca genera fechas anteriores al 2024-01-01", () => {
        const r = rng(999);
        const min = Date.UTC(2024, 0, 1);
        for (let i = 0; i < 1000; i++) {
            expect(fechaRepartidaV4(r, AHORA).getTime()).toBeGreaterThanOrEqual(min);
        }
    });

    it("hora en punto (coherente con G20)", () => {
        const r = rng(2026);
        for (let i = 0; i < 500; i++) {
            const f = fechaRepartidaV4(r, AHORA);
            expect(f.getUTCMinutes()).toBe(0);
            expect(f.getUTCSeconds()).toBe(0);
        }
    });

    it("densidad en LOS TRES años (nada de dos reportes sueltos por tramo)", () => {
        const r = rng(42);
        const porAnio = new Map<number, number>();
        for (let i = 0; i < 5000; i++) {
            const a = fechaRepartidaV4(r, AHORA).getUTCFullYear();
            porAnio.set(a, (porAnio.get(a) ?? 0) + 1);
        }
        for (const { anio } of PESOS_ANIO_V4) {
            expect(porAnio.get(anio) ?? 0, `año ${anio} con muy pocos reportes`).toBeGreaterThan(500);
        }
    });
});

describe("demo v4 · geografía (Jelkin: más países, más ciudades)", () => {
    it("cubre 20 países", () => {
        expect(PAISES_DEMO4.length).toBe(20);
    });

    it("cubre 100+ ciudades reales", () => {
        expect(CIUDADES_DEMO4.length).toBeGreaterThanOrEqual(100);
    });

    it("cada país tiene al menos una ciudad", () => {
        const paisesEnCiudades = new Set(CIUDADES_DEMO4.map((c) => c.split(":")[0]));
        for (const p of PAISES_DEMO4) {
            expect(paisesEnCiudades.has(p), `país ${p} sin ciudades en el catálogo v4`).toBe(true);
        }
    });

    it("suma países NUEVOS respecto a v2 (BR VE PY BO CR PA GT DO HN SV NI ES US)", () => {
        const paisesV2 = new Set<string>(["CO", "MX", "AR", "PE", "CL", "EC", "UY"]);
        const nuevos = new Set<string>(PAISES_DEMO4.filter((p) => !paisesV2.has(p)));
        expect(nuevos.size).toBeGreaterThanOrEqual(11);
        // Los pedidos expresos por Jelkin están todos.
        for (const p of ["ES", "US", "BR", "CR", "PA", "DO", "GT", "BO", "PY", "VE", "HN"]) {
            expect(nuevos.has(p), `falta país nuevo ${p}`).toBe(true);
        }
    });

    it("todas las ciudades tienen formato \"XX:Nombre\" con código de país conocido", () => {
        const paisesSet = new Set<string>(PAISES_DEMO4);
        for (const c of CIUDADES_DEMO4) {
            const partes = c.split(":");
            expect(partes.length, `formato roto en "${c}"`).toBe(2);
            expect(paisesSet.has(partes[0]!), `código de país fuera de PAISES_DEMO4: "${c}"`).toBe(true);
            expect((partes[1] ?? "").length, `nombre de ciudad vacío en "${c}"`).toBeGreaterThan(0);
        }
    });

    it("no hay ciudades duplicadas en el catálogo", () => {
        const set = new Set(CIUDADES_DEMO4);
        expect(set.size, "hay entradas duplicadas en CIUDADES_DEMO4").toBe(CIUDADES_DEMO4.length);
    });
});

describe("demo v4 · categorías (sensibles pesan más)", () => {
    it("cada categoría tiene al menos 3 relatos propios", () => {
        for (const [cat, textos] of Object.entries(RELATOS)) {
            expect(textos.length, `${cat} con muy pocos relatos`).toBeGreaterThanOrEqual(3);
        }
    });

    it("SPAM pesa menos que las categorías sensibles", () => {
        const peso = (c: string) => PESOS_CATEGORIA.find((p) => p.categoria === c)?.peso ?? 0;
        expect(peso("SOLICITUD_MATERIAL")).toBeGreaterThan(peso("SPAM"));
        expect(peso("COMPARTIMIENTO_SEXUAL")).toBeGreaterThan(peso("SPAM"));
    });
});

describe("demo v4 · volumen (Jelkin: 5000)", () => {
    it("DEMO4.nReportes es 5000", () => {
        expect(DEMO4.nReportes).toBe(5000);
    });
});
