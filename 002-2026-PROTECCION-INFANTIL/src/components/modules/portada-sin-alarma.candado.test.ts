/**
 * SPEC-456 · «cara» del rediseño: la portada le habla a un padre, no a un inversor.
 *
 * Candados de conducta verificables en fuente:
 *  1. Los canales oficiales (141, ICBF…) se montan ANTES del hero+consulta, no al
 *     final — son la prueba de seriedad más fuerte y estaban enterrados (P-5).
 *  2. El hero no trae color crudo (0 hex ni escala Tailwind) — marca por token (P-1).
 *  3. La voz no es jerga: el titular va en Instrument Serif y la bajada no dice
 *     «identificadores» ni «conductas de riesgo» (P-2/P-3).
 *
 * Contraprueba (por mutación, comprobada al escribir el candado):
 *  · volver el orden viejo (CanalesOficiales tras ConsultaPublica) → rojo del test 1;
 *  · devolver un `sky-*`/`red-*` al hero → rojo del test 2;
 *  · devolver la jerga «identificadores…» a la bajada → rojo del test 3.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..", "..", "..");
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), "utf-8");
const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-456 · los canales oficiales no están enterrados", () => {
    it("`HomePageClient` monta <CanalesOficiales> antes de <ConsultaPublica>", () => {
        const src = sinComentarios(leer("src/components/modules/HomePageClient.tsx"));
        const iCanales = src.indexOf("<CanalesOficiales");
        const iConsulta = src.indexOf("<ConsultaPublica");
        expect(iCanales, "no encontré <CanalesOficiales> en la portada").toBeGreaterThanOrEqual(0);
        expect(iConsulta, "no encontré <ConsultaPublica> en la portada").toBeGreaterThanOrEqual(0);
        expect(
            iCanales < iConsulta,
            "Los canales oficiales deben ir ARRIBA (antes del hero+consulta): son la prueba " +
                "de seriedad más fuerte y no pueden quedar enterrados al final (P-5).",
        ).toBe(true);
    });
});

describe("SPEC-456 · el hero vive en la marca y habla en «tú»", () => {
    const hero = () => sinComentarios(leer("src/components/modules/LandingHero.tsx"));

    it("el hero no trae ningún color crudo (hex ni escala Tailwind)", () => {
        const crudos = hero().match(CRUDO) ?? [];
        expect(
            crudos,
            "Color crudo en LandingHero — la marca va por token (cielo/pino) y el error por rubi. " +
                `Encontrado: ${crudos.join(", ")}`,
        ).toEqual([]);
    });

    it("el titular va en Instrument Serif y la bajada no es jerga institucional", () => {
        const src = hero();
        expect(/font-serif/.test(src), "El titular del hero debe ir en Instrument Serif (font-serif).").toBe(true);
        for (const jerga of ["identificadores", "conductas de riesgo"]) {
            expect(
                new RegExp(jerga, "i").test(src),
                `La portada no le habla a un padre asustado con «${jerga}»: voz «tú», sin jerga (P-2).`,
            ).toBe(false);
        }
    });
});
