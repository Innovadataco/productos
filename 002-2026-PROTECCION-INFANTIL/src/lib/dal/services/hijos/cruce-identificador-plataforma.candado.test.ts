/**
 * SPEC-716 · I-429 · CANDADO del helper del cruce (identificador, plataforma).
 *
 * DECISIÓN del nulo (conducta, no efecto): un identificador SIN plataforma NO cruza ningún reporte.
 * `paresMatcheables` lo EXCLUYE del where — `Reporte.plataformaId` es NOT NULL, no existe reporte
 * con plataforma nula que pueda matchear. Y la clave distingue plataformas: el mismo alias en dos
 * redes son dos claves distintas (dos cuentas). Puro, sin BD → raíz estructural que heredan las
 * tres consultas (tieneReportes, aviso, «A quién protejo»).
 */
import { describe, it, expect } from "vitest";
import { claveParIdentificador, paresMatcheables } from "./cruce-identificador-plataforma";

describe("SPEC-716 · I-429 · cruce por (identificador, plataforma)", () => {
    it("paresMatcheables EXCLUYE los identificadores sin plataforma (null NO cruza)", () => {
        const out = paresMatcheables([
            { valor: "@a", plataformaId: "wa" },
            { valor: "@b", plataformaId: null }, // sin plataforma → fuera del where
            { valor: "@c", plataformaId: "ig" },
        ]);
        expect(out).toEqual([
            { identificador: "@a", plataformaId: "wa" },
            { identificador: "@c", plataformaId: "ig" },
        ]);
    });

    it("solo-nulos → vacío (el caller corta y no consulta; nada cruza)", () => {
        expect(paresMatcheables([{ valor: "@a", plataformaId: null }])).toEqual([]);
    });

    it("la clave distingue plataformas: mismo alias en dos redes = dos claves", () => {
        expect(claveParIdentificador({ valor: "@a", plataformaId: "wa" })).not.toBe(
            claveParIdentificador({ valor: "@a", plataformaId: "ig" }),
        );
    });

    it("la clave del nulo es estable y distinta de la de cualquier plataforma real", () => {
        const nula = claveParIdentificador({ valor: "@a", plataformaId: null });
        expect(nula).toBe(claveParIdentificador({ valor: "@a", plataformaId: null }));
        expect(nula).not.toBe(claveParIdentificador({ valor: "@a", plataformaId: "wa" }));
    });
});
