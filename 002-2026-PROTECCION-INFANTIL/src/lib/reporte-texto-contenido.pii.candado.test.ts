/**
 * SPEC-904 (I-422 · Ley 1581) · CANDADO: la PII literal detectada se guarda CIFRADA en reposo bajo
 * la DEK del reporte, nunca en claro. Muere con el defecto: si se persistiera plana, el ciphertext
 * contendría el literal y/o el roundtrip no haría falta.
 *
 * Cubre: (a) el ciphertext NO contiene el literal (un select crudo no devuelve «Juan»/teléfono);
 * (b) ROUNDTRIP exacto (cifrar→descifrar reconstruye la lista idéntica — el anonimizador depende de
 * que los fragmentos coincidan); (c) lista vacía → null → []; (d) purga (baja) → null → []; (e)
 * cripto-shred: muerta la DEK, descifrar LANZA (ilegible = borrado real); (f) el descifrador de
 * TEXTO rechaza `piiDetectada` (vive en otra columna). Integración (BD por worktree).
 */
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
    sellarTextoNuevo,
    sellarPiiDetectada,
    descifrarPiiDetectada,
    descifrarCampo,
    purgarPiiDetectada,
} from "@/lib/reporte-texto-contenido";

const PII = ["Juan Pérez", "+573001112233", "Colegio San José"];

describe("SPEC-904 · piiDetectada cifrada en reposo", () => {
    const creados: string[] = [];

    afterEach(async () => {
        // Borrar el contenido cascada su LlaveReporte (onDelete Cascade). deleteMany es idempotente.
        if (creados.length > 0) {
            await prisma.contenidoReporte.deleteMany({ where: { id: { in: creados } } });
            creados.length = 0;
        }
    });

    async function nuevoContenido(): Promise<string> {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "relato de prueba" });
        creados.push(contenidoId);
        return contenidoId;
    }

    it("sella CIFRADO: el ciphertext NO contiene el literal y el roundtrip devuelve EXACTO", async () => {
        const cid = await nuevoContenido();
        await sellarPiiDetectada(prisma, cid, PII);

        const crudo = await prisma.contenidoReporte.findUniqueOrThrow({
            where: { id: cid },
            select: { piiDetectadaCifrado: true },
        });
        expect(crudo.piiDetectadaCifrado).not.toBeNull();
        for (const fragmento of PII) {
            expect(crudo.piiDetectadaCifrado!).not.toContain(fragmento);
        }

        const descifrada = await descifrarPiiDetectada(prisma, cid);
        expect(descifrada).toEqual(PII);
    });

    it("lista vacía → piiDetectadaCifrado null → descifrar []", async () => {
        const cid = await nuevoContenido();
        await sellarPiiDetectada(prisma, cid, PII);
        await sellarPiiDetectada(prisma, cid, []); // re-sellar vacío

        const crudo = await prisma.contenidoReporte.findUniqueOrThrow({
            where: { id: cid },
            select: { piiDetectadaCifrado: true },
        });
        expect(crudo.piiDetectadaCifrado).toBeNull();
        expect(await descifrarPiiDetectada(prisma, cid)).toEqual([]);
    });

    it("purga (baja) → cifrado null → descifrar []", async () => {
        const cid = await nuevoContenido();
        await sellarPiiDetectada(prisma, cid, PII);
        await purgarPiiDetectada(prisma, cid);
        expect(await descifrarPiiDetectada(prisma, cid)).toEqual([]);
    });

    it("cripto-shred: muerta la DEK (llave), descifrar LANZA (ilegible = borrado real)", async () => {
        const cid = await nuevoContenido();
        await sellarPiiDetectada(prisma, cid, PII);
        await prisma.llaveReporte.delete({ where: { contenidoId: cid } });
        await expect(descifrarPiiDetectada(prisma, cid)).rejects.toThrow();
    });

    it("el descifrador de TEXTO rechaza 'piiDetectada' (vive en otra columna)", async () => {
        const cid = await nuevoContenido();
        await expect(descifrarCampo(prisma, cid, "piiDetectada")).rejects.toThrow(/piiDetectada/);
    });
});
