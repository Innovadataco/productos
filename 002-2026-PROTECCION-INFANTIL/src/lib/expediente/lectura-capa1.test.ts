/**
 * SPEC-340 (T024) — tabla de casos de la lectura determinista.
 * Decisiones ratificadas: D1 (empate → sin dominante) · D3 ajustada (la
 * aceleración exige un "antes": previos7 >= 1 — {1,0} sería ruido).
 */
import { describe, it, expect } from "vitest";
import { lecturaCapa1, type HechoCapa1 } from "./lectura-capa1";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function hecho(p: Omit<Partial<HechoCapa1>, "fecha"> & { fecha: string }): HechoCapa1 {
    return {
        fecha: new Date(p.fecha),
        ciudad: p.ciudad ?? null,
        pais: p.pais ?? null,
        clasificacion: p.clasificacion ?? null,
        esPropio: p.esPropio ?? false,
        esAnonimo: p.esAnonimo ?? false,
        edadReportada: p.edadReportada ?? null,
    };
}

describe("lecturaCapa1 (SPEC-340)", () => {
    it("C01 · el ejemplo canónico: 5 hechos, 4 entre 21:00-23:59 Bogotá", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-20T02:30:00Z", ciudad: "Bogotá", clasificacion: "CONTACTO_INSISTENTE", esPropio: true, edadReportada: 13 }),
            hecho({ fecha: "2026-08-22T03:15:00Z", ciudad: "Bogotá", clasificacion: "SOLICITUD_MATERIAL", edadReportada: 13 }),
            hecho({ fecha: "2026-08-25T04:45:00Z", ciudad: "Medellín", clasificacion: "SOLICITUD_MATERIAL", esAnonimo: true, edadReportada: 14 }),
            hecho({ fecha: "2026-08-27T14:00:00Z", clasificacion: "SOLICITUD_MATERIAL", esAnonimo: true }),
            hecho({ fecha: "2026-08-30T02:10:00Z", ciudad: "Bogotá", clasificacion: "EXTORSION", edadReportada: 12 }),
        ]);
        expect(r.franjas.dominante).toEqual({ inicio: "21:00", fin: "23:59", conteo: 4, total: 5 });
        expect(r.escalada).toEqual({ primera: "CONTACTO_INSISTENTE", ultima: "EXTORSION" });
        expect(r.aceleracion).toEqual({ ultimos7: 3, previos7: 2 });
        expect(r.alcance.reporteros).toBe(5);
        expect(r.perfil).toEqual({ edadMin: 12, edadMax: 14 });
        expect(r.ciudades.lista).toEqual([
            { ciudad: "Bogotá", conteo: 3 },
            { ciudad: "Medellín", conteo: 1 },
        ]);
        expect(r.ciudades.masReciente?.ciudad).toBe("Bogotá");
    });

    it("C02 · un solo hecho: sin escalada NI aceleración (no hay un 'antes')", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-30T15:00:00Z", ciudad: "Cali", clasificacion: "CONTACTO_INSISTENTE", esPropio: true, edadReportada: 12 }),
        ]);
        expect(r.franjas.dominante).toEqual({ inicio: "09:00", fin: "11:59", conteo: 1, total: 1 });
        expect(r.escalada).toBeNull();
        expect(r.aceleracion, "D3 ajustada: {1,0} es ruido, no aceleración").toBeNull();
        expect(r.alcance.reporteros).toBe(1);
        expect(r.perfil).toEqual({ edadMin: 12, edadMax: 12 });
    });

    it("C03 · lista vacía: todo nulo o vacío, sin romperse", () => {
        const r = lecturaCapa1([]);
        expect(r.total).toBe(0);
        expect(r.franjas.bloques).toEqual([]);
        expect(r.franjas.dominante).toBeNull();
        expect(r.escalada).toBeNull();
        expect(r.aceleracion).toBeNull();
        expect(r.alcance.reporteros).toBe(0);
        expect(r.perfil).toBeNull();
        expect(r.ciudades.masReciente).toBeNull();
    });

    it("C04 · todos sin ciudad: lista vacía pero masReciente existe con ciudad null", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-28T13:00:00Z", esAnonimo: true }),
            hecho({ fecha: "2026-08-29T13:30:00Z", esAnonimo: true }),
            hecho({ fecha: "2026-08-30T14:00:00Z", esAnonimo: true }),
        ]);
        expect(r.ciudades.lista).toEqual([]);
        expect(r.ciudades.masReciente).toEqual({ ciudad: null, fecha: new Date("2026-08-30T14:00:00Z") });
        expect(r.perfil).toBeNull();
        expect(r.alcance.reporteros, "sin propio: 0 + 3 ajenos").toBe(3);
    });

    it("C05 · empate de ciudades 2-2-1: alfabético en el empate, y sin escalada uniforme", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-25T20:00:00Z", ciudad: "Medellín", clasificacion: "CONTACTO_INSISTENTE", esPropio: true }),
            hecho({ fecha: "2026-08-26T20:30:00Z", ciudad: "Bogotá", clasificacion: "CONTACTO_INSISTENTE" }),
            hecho({ fecha: "2026-08-27T21:00:00Z", ciudad: "Bogotá", clasificacion: "CONTACTO_INSISTENTE" }),
            hecho({ fecha: "2026-08-28T21:30:00Z", ciudad: "Medellín", clasificacion: "CONTACTO_INSISTENTE" }),
            hecho({ fecha: "2026-08-29T22:00:00Z", ciudad: "Cali", clasificacion: "CONTACTO_INSISTENTE" }),
        ]);
        expect(r.ciudades.lista.map((c) => c.ciudad)).toEqual(["Bogotá", "Medellín", "Cali"]);
        expect(r.escalada).toBeNull();
    });

    it("C07 · clasificaciones null intercaladas: la escalada las salta", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-10T16:00:00Z", ciudad: "Bogotá", esPropio: true }),
            hecho({ fecha: "2026-08-14T16:00:00Z", ciudad: "Bogotá", clasificacion: "CONTACTO_INSISTENTE", edadReportada: 15 }),
            hecho({ fecha: "2026-08-18T16:00:00Z", ciudad: "Bogotá", clasificacion: "EXTORSION" }),
            hecho({ fecha: "2026-08-22T16:00:00Z", ciudad: "Bogotá" }),
        ]);
        expect(r.escalada).toEqual({ primera: "CONTACTO_INSISTENTE", ultima: "EXTORSION" });
        expect(r.aceleracion, "2 vs 2 no supera").toBeNull();
        expect(r.perfil).toEqual({ edadMin: 15, edadMax: 15 });
    });

    it("C08 · cruce de medianoche Bogotá: 23:50 y 00:10 son bloques distintos; empate → sin dominante (D1)", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-28T04:50:00Z", ciudad: "Cali", clasificacion: "CONTACTO_INSISTENTE", esPropio: true, edadReportada: 14 }),
            hecho({ fecha: "2026-08-28T05:10:00Z", ciudad: "Cali", clasificacion: "CONTACTO_INSISTENTE" }),
        ]);
        expect(r.franjas.bloques).toEqual([
            { inicio: "00:00", fin: "02:59", conteo: 1 },
            { inicio: "21:00", fin: "23:59", conteo: 1 },
        ]);
        expect(r.franjas.dominante, "empate: no se inventa dominancia").toBeNull();
    });

    it("C09 · LA TRAMPA: madrugada UTC = noche Bogotá del día anterior", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-20T02:59:00Z", ciudad: "Barranquilla", clasificacion: "SOLICITUD_MATERIAL", esAnonimo: true, edadReportada: 11 }),
            hecho({ fecha: "2026-08-24T03:30:00Z", ciudad: "Barranquilla", clasificacion: "SOLICITUD_MATERIAL", esAnonimo: true, edadReportada: 12 }),
            hecho({ fecha: "2026-08-28T04:59:00Z", ciudad: "Soledad", clasificacion: "EXTORSION" }),
        ]);
        // Una implementación en hora UTC los repartiría en 00-02:59 y 03-05:59.
        expect(r.franjas.bloques).toEqual([{ inicio: "21:00", fin: "23:59", conteo: 3 }]);
        expect(r.aceleracion).toEqual({ ultimos7: 2, previos7: 1 });
        expect(r.alcance.reporteros, "sin propio").toBe(3);
    });

    it("C10 · aceleración en el límite exacto (168h/336h): bordes de ventana", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-17T12:00:00Z", ciudad: "Cartagena", clasificacion: "CONTACTO_INSISTENTE" }), // = ancla-336h → ninguna
            hecho({ fecha: "2026-08-24T12:00:00Z", ciudad: "Cartagena", clasificacion: "CONTACTO_INSISTENTE" }), // = ancla-168h → anterior
            hecho({ fecha: "2026-08-24T12:00:01Z", ciudad: "Cartagena", clasificacion: "CONTACTO_INSISTENTE" }), // 1s adentro → reciente
            hecho({ fecha: "2026-08-31T12:00:00Z", ciudad: "Cartagena", clasificacion: "CONTACTO_INSISTENTE", esPropio: true }), // ancla → reciente
        ]);
        expect(r.aceleracion).toEqual({ ultimos7: 2, previos7: 1 });
    });

    it("C11 · alcance: dos propios cuentan 1; el anonimato no altera el conteo", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-26T18:00:00Z", ciudad: "Bogotá", esPropio: true, edadReportada: 10 }),
            hecho({ fecha: "2026-08-27T18:30:00Z", ciudad: "Bogotá", esAnonimo: true }),
            hecho({ fecha: "2026-08-28T19:00:00Z", ciudad: "Bogotá", esAnonimo: true, edadReportada: 17 }),
            hecho({ fecha: "2026-08-29T19:30:00Z", ciudad: "Bogotá" }),
            hecho({ fecha: "2026-08-30T20:00:00Z", ciudad: "Bogotá", esPropio: true }),
        ]);
        expect(r.alcance.reporteros, "1 propio + 3 ajenos").toBe(4);
        expect(r.perfil).toEqual({ edadMin: 10, edadMax: 17 });
    });

    it("C12 · entrada desordenada: el módulo ordena por fecha, no por posición", () => {
        const r = lecturaCapa1([
            hecho({ fecha: "2026-08-30T20:00:00Z", ciudad: "Envigado", clasificacion: "EXTORSION", edadReportada: 13 }),
            hecho({ fecha: "2026-08-10T20:00:00Z", ciudad: "Medellín", clasificacion: "CONTACTO_INSISTENTE", esPropio: true, edadReportada: 12 }),
            hecho({ fecha: "2026-08-20T20:00:00Z", ciudad: "Medellín", clasificacion: "SOLICITUD_MATERIAL", edadReportada: 13 }),
        ]);
        expect(r.escalada, "por fecha: CI primera, EX última").toEqual({
            primera: "CONTACTO_INSISTENTE",
            ultima: "EXTORSION",
        });
        expect(r.ciudades.masReciente?.ciudad).toBe("Envigado");
    });

    it("ANTI-PLANTILLA: el módulo no contiene ninguna frase interpretativa", () => {
        const fuente = readFileSync(join(__dirname, "lectura-capa1.ts"), "utf8");
        for (const frase of ["se está moviendo", "se concentra", "está subiendo", "acelerando", "preocupante", "peligros"]) {
            expect(fuente.toLowerCase(), `la frase interpretativa "${frase}" no puede vivir en la capa 1`).not.toContain(frase);
        }
    });
});
