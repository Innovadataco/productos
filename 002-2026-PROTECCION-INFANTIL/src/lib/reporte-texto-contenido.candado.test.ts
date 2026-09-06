/**
 * S-D · Candado de conducta de la capa DEK-por-denuncia (`reporte-texto-contenido`).
 *
 * Verifica la propiedad central: el texto se cifra con la DEK (round-trip idéntico, nada en
 * claro en la BD) y **quemar la llave lo vuelve ilegible** (cripto-shred = borrado real). Si
 * alguien rompiera el AAD, la DEK o el fail-loud, este test cae.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { sellarTextoNuevo, descifrarCampo } from "@/lib/reporte-texto-contenido";

const KEK = randomBytes(32).toString("base64");

describe("S-D · DEK por denuncia (cifrar/descifrar + cripto-shred)", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.REPORTE_TEXTO_KEY_V1 = KEK;
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("round-trip: sella y descifra ambos campos idénticos; nada en claro en la BD", async () => {
        const relato = "Mi hija de 9 años me dice que un adulto del colegio la incomoda · áéíóú ñ";
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: relato, origenEvidencia: "ORIGINAL" });

        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe(relato);
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe(relato);

        // La fila almacenada es ruido: no contiene el relato en claro.
        const fila = await prisma.contenidoReporte.findUniqueOrThrow({ where: { id: contenidoId } });
        expect(fila.textoCifrado).not.toContain("adulto");
        expect(fila.textoOriginalCifrado).not.toContain("adulto");
    });

    it("cripto-shred: quemar la LlaveReporte deja el texto ILEGIBLE (descifrar LANZA)", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "secreto de la denuncia", origenEvidencia: "ORIGINAL" });
        // Quemar la DEK (lo que hace el borrado real del caso vía Cascade).
        await prisma.llaveReporte.delete({ where: { contenidoId } });
        await expect(descifrarCampo(prisma, contenidoId, "texto")).rejects.toThrow();
    });

    it("textoOriginal por defecto = texto al crear (el original es el relato del reportante)", async () => {
        const relato = "relato único del reportante";
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: relato });
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe(relato);
    });
});
