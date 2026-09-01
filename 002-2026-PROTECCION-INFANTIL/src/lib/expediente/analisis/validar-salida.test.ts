/**
 * SPEC-341 · T016 · validador anti-frases prohibidas del análisis (FR-014).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { validarSalida, _invalidarCacheParaTests } from "./validar-salida";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

async function sembrarFrases(frases: string[]) {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.analisis.frases_prohibidas_json" },
        update: { valor: JSON.stringify(frases) },
        create: {
            clave: "padre.analisis.frases_prohibidas_json",
            valor: JSON.stringify(frases),
            tipo: "JSON",
            categoria: "SYSTEM",
            esPublico: false,
        },
    });
    _invalidarCacheParaTests();
}

describe("validarSalida (SPEC-341)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("pasa cuando el texto no contiene ninguna frase prohibida", async () => {
        await sembrarFrases(["podría ser un depredador", "es un caso claro de"]);
        const r = await validarSalida("Se observa una concentración de mensajes en la noche.");
        expect(r.ok).toBe(true);
    });

    it("rechaza cuando contiene una frase exacta (case-insensitive)", async () => {
        await sembrarFrases(["podría ser un depredador", "es un caso claro de"]);
        const r = await validarSalida("En este caso, esto ES UN CASO CLARO DE grooming.");
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.motivo).toBe("frase_prohibida");
            expect(r.fraseDetectada).toBe("es un caso claro de");
        }
    });

    it("pasa cuando la lista está vacía (no filtra nada)", async () => {
        await sembrarFrases([]);
        const r = await validarSalida("Este texto sería rechazado si la lista tuviera frases, pero está vacía.");
        expect(r.ok).toBe(true);
    });

    it("tolera JSON mal formado — devuelve OK y logea warn (no rompe el worker)", async () => {
        await prisma.parametroSistema.upsert({
            where: { clave: "padre.analisis.frases_prohibidas_json" },
            update: { valor: "{malformado" },
            create: {
                clave: "padre.analisis.frases_prohibidas_json",
                valor: "{malformado",
                tipo: "JSON",
                categoria: "SYSTEM",
                esPublico: false,
            },
        });
        _invalidarCacheParaTests();
        const r = await validarSalida("cualquier cosa");
        expect(r.ok).toBe(true);
    });
});
