import { describe, it, expect } from "vitest";
import { RUBRICA_SEMILLA, DEFINICIONES_CATEGORIA, CATEGORIAS_RUBRICA } from "./rubrica-semilla";

const CATEGORIAS_LEY_2564_NUEVAS = ["CIBERACOSO", "HAPPY_SLAPPING", "STALKING"];

describe("RUBRICA_SEMILLA — categorías Ley 2564 (SPEC-248 / 002-PI-151)", () => {
    it.each(CATEGORIAS_LEY_2564_NUEVAS)("%s tiene 5 preguntas con las 2 primeras decisivas", (categoria) => {
        const preguntas = RUBRICA_SEMILLA[categoria];
        expect(preguntas).toHaveLength(5);
        expect(preguntas[0].tipo).toBe("decisiva");
        expect(preguntas[1].tipo).toBe("decisiva");
        expect(preguntas.slice(2).every((p) => p.tipo !== "decisiva")).toBe(true);
    });

    it("incluye las 3 categorías nuevas en CATEGORIAS_RUBRICA", () => {
        for (const cat of CATEGORIAS_LEY_2564_NUEVAS) {
            expect(CATEGORIAS_RUBRICA).toContain(cat);
        }
    });
});

describe("DEFINICIONES_CATEGORIA (SPEC-248 / 002-PI-151)", () => {
    it("tiene exactamente 14 entradas", () => {
        expect(Object.keys(DEFINICIONES_CATEGORIA)).toHaveLength(14);
    });

    it("no incluye OTRO (categoría residual sin conducta legal propia)", () => {
        expect(DEFINICIONES_CATEGORIA.OTRO).toBeUndefined();
    });

    it.each(CATEGORIAS_LEY_2564_NUEVAS)("%s tiene los 3 campos obligatorios no vacíos", (categoria) => {
        const def = DEFINICIONES_CATEGORIA[categoria];
        expect(def.conductaLegal.length).toBeGreaterThan(0);
        expect(def.definicionLiteral.length).toBeGreaterThan(0);
        expect(def.referenciaNormativa.length).toBeGreaterThan(0);
    });

    it("las 5 categorías de grooming comparten conductaLegal pero difieren en rolDentroDeConducta", () => {
        const grupoGrooming = ["CONTACTO_INSISTENTE", "SOLICITUD_MATERIAL", "OFRECIMIENTO_REGALOS", "SUPLANTACION_IDENTIDAD", "SOLICITUD_ENCUENTRO"];
        const roles = new Set<string>();
        for (const cat of grupoGrooming) {
            expect(DEFINICIONES_CATEGORIA[cat].conductaLegal).toBe("Grooming");
            expect(DEFINICIONES_CATEGORIA[cat].rolDentroDeConducta).toBeTruthy();
            roles.add(DEFINICIONES_CATEGORIA[cat].rolDentroDeConducta!);
        }
        expect(roles.size).toBe(5);
    });
});
