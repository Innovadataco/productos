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
import {
    sellarTextoNuevo,
    descifrarCampo,
    descifrarCampos,
    resellarCampo,
    estaPurgado,
    purgarTextoTrabajo,
    restaurarTextoTrabajo,
    MARCADOR_TEXTO_PURGADO,
} from "@/lib/reporte-texto-contenido";

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

    it("resellarCampo reescribe el texto de TRABAJO y deja el ORIGINAL intacto (evidencia inmutable)", async () => {
        const original = "relato original crudo del reportante";
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: original, origenEvidencia: "ORIGINAL" });

        await resellarCampo(prisma, contenidoId, "texto", "relato ANONIMIZADO (puntitos negros)");

        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe("relato ANONIMIZADO (puntitos negros)");
        // El original NO se movió: sigue siendo la evidencia legal del alta.
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe(original);
    });

    it("resellarCampo NO rota la DEK: mismo llavero, mismo kekVersion tras el resellado", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "v1" });
        const antes = await prisma.llaveReporte.findUniqueOrThrow({ where: { contenidoId } });
        await resellarCampo(prisma, contenidoId, "texto", "v2");
        const despues = await prisma.llaveReporte.findUniqueOrThrow({ where: { contenidoId } });
        expect(despues.dekCifrada).toBe(antes.dekCifrada);
        expect(despues.kekVersion).toBe(antes.kekVersion);
    });

    it("CANDADO: resellar el ORIGINAL está PROHIBIDO — forzar el campo por JS LANZA y no toca la evidencia", async () => {
        const original = "evidencia que nadie puede pisar";
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: original });
        // El tipo `CampoResellable` ya lo impide en compilación; esto cubre el bypass por JS.
        await expect(
            // @ts-expect-error — "textoOriginal" NO es un CampoResellable (cerrado a propósito).
            resellarCampo(prisma, contenidoId, "textoOriginal", "intento de borrar la evidencia")
        ).rejects.toThrow(/no es re-sellable|inmutable/i);
        // La evidencia sigue intacta.
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe(original);
    });

    it("descifrarCampos (batch): descifra el mismo campo de N contenidos en un Map correcto", async () => {
        const a = await sellarTextoNuevo(prisma, { texto: "relato A" });
        const b = await sellarTextoNuevo(prisma, { texto: "relato B" });
        const c = await sellarTextoNuevo(prisma, { texto: "relato C" });

        const mapa = await descifrarCampos(prisma, [a.contenidoId, b.contenidoId, c.contenidoId], "texto");
        expect(mapa.size).toBe(3);
        expect(mapa.get(a.contenidoId)).toBe("relato A");
        expect(mapa.get(b.contenidoId)).toBe("relato B");
        expect(mapa.get(c.contenidoId)).toBe("relato C");
    });

    it("descifrarCampos con lista vacía devuelve Map vacío (no toca la BD)", async () => {
        expect((await descifrarCampos(prisma, [], "texto")).size).toBe(0);
    });

    it("descifrarCampos es fail-loud: un contenidoId sin llave (cripto-shred/corrupción) LANZA", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "se quema" });
        await prisma.llaveReporte.delete({ where: { contenidoId } });
        await expect(descifrarCampos(prisma, [contenidoId], "texto")).rejects.toThrow(/falta (contenido|llave)|corrupción/i);
    });

    it("purgarTextoTrabajo (baja D4): trabajo → marcador CIFRADO, original intacto, estaPurgado=true", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "relato de trabajo", textoOriginal: "evidencia original" });
        expect(await estaPurgado(prisma, contenidoId)).toBe(false);

        await purgarTextoTrabajo(prisma, contenidoId);

        expect(await estaPurgado(prisma, contenidoId)).toBe(true);
        // Cualquier lector (incl. batch) obtiene el marcador, no el texto purgado.
        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe(MARCADOR_TEXTO_PURGADO);
        expect((await descifrarCampos(prisma, [contenidoId], "texto")).get(contenidoId)).toBe(MARCADOR_TEXTO_PURGADO);
        // La evidencia original NO se tocó.
        expect(await descifrarCampo(prisma, contenidoId, "textoOriginal")).toBe("evidencia original");
    });

    it("restaurarTextoTrabajo (reactivar): restaura el trabajo desde el original y limpia purgadoEn", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "trabajo", textoOriginal: "evidencia original" });
        await purgarTextoTrabajo(prisma, contenidoId);
        await restaurarTextoTrabajo(prisma, contenidoId);

        expect(await estaPurgado(prisma, contenidoId)).toBe(false);
        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe("evidencia original");
    });

    it("restaurarTextoTrabajo SIN purga previa NO pisa el trabajo con el original (condicional, lifecycle:228)", async () => {
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "trabajo anonimizado", textoOriginal: "original crudo" });
        await restaurarTextoTrabajo(prisma, contenidoId); // no estaba purgado
        expect(await descifrarCampo(prisma, contenidoId, "texto")).toBe("trabajo anonimizado");
        expect(await estaPurgado(prisma, contenidoId)).toBe(false);
    });
});
