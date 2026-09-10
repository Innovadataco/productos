/**
 * I-366 · CANDADO — el cripto-shred es COMPLETO: no queda copia bajo la llave global vieja.
 *
 * SPEC-581 (aditiva) dejó `Reporte.texto`, `Reporte.textoOriginal` y `EventoExpediente.texto`
 * congeladas en la BD: quemar la DEK NO destruía esa copia (shred parcial e invisible). La
 * migración `20260910120000_i366_purgar_texto_llave_global` las dropea. Este candado vigila que
 * el shred quede completo, en dos mitades — ninguna trivial:
 *
 *  (1) ESTRUCTURAL: las tres columnas viejas NO existen. Si una migración futura re-agrega una
 *      columna de texto plano/llave-global, esto muere (recurrencia de I-366).
 *  (2) CONDUCTA CON DATO REAL: se siembra un relato REAL, se confirma legible, se quema la DEK
 *      (borrar `LlaveReporte`) y se afirma que NO queda nada recuperable. Sobre una BD ya vacía
 *      no probaría nada — por eso se siembra el dato real primero (dev-candado-no-fuga-necesita-el-dato-real).
 *      Post-drop la ÚNICA copia posible es la envuelta por DEK; quemarla no deja rastro legible.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { sellarTextoNuevo, descifrarCampo } from "@/lib/reporte-texto-contenido";

describe("I-366 · cripto-shred COMPLETO (sin copia de llave global vieja)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("(estructural) las columnas de texto viejo NO existen — Reporte.texto/textoOriginal, EventoExpediente.texto", async () => {
        const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
            SELECT table_name, column_name
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND (   (table_name = 'Reporte'          AND column_name IN ('texto', 'textoOriginal'))
                    OR (table_name = 'EventoExpediente' AND column_name = 'texto') )`;
        expect(
            cols,
            `columnas de texto viejo aún presentes (la migración I-366 no corrió, o una migración las re-agregó): ${cols
                .map((c) => `${c.table_name}.${c.column_name}`)
                .join(", ")}`
        ).toEqual([]);
    });

    it("(conducta, dato REAL) quemar la DEK vuelve el relato IRRECUPERABLE — no verifica el vacío", async () => {
        const relato = "RELATO REAL de prueba — I-366 · " + Date.now();
        const evidencia = "EVIDENCIA ORIGINAL — inmutable · " + Date.now();
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: relato, textoOriginal: evidencia });

        // Precondición: el dato real ESTÁ y se lee (si esto fallara, el test probaría el vacío).
        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe(relato);
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe(evidencia);

        // Quemar la DEK: sin `LlaveReporte` no hay cómo desenvolver la DEK → texto irrecuperable.
        await prisma.llaveReporte.delete({ where: { contenidoId } });

        // La única copia (envuelta por DEK) ya no se puede descifrar; no hay copia vieja (ver test 1).
        await expect(descifrarCampo(prisma, contenidoId, "texto")).rejects.toThrow();
        await expect(descifrarCampo(prisma, contenidoId, "textoOriginal")).rejects.toThrow();
    });
});
