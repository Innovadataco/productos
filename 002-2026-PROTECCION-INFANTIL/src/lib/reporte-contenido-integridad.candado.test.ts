/**
 * S-D · Candados de INTEGRIDAD de `ContenidoReporte` (correcciones CEO 06-09).
 *
 * RISK 1 — el borrón total DESTRUYE el texto: un contenido cifrado sin dueño vivo (y su DEK)
 *          se barre → cripto-shred real; el contenido de un caso vivo NO se toca.
 * RISK 2 — XOR de dueño: un ContenidoReporte pertenece a EXACTAMENTE un dueño; el motor
 *          rechaza que un Reporte y un EventoExpediente compartan la misma fila cifrada.
 *
 * Ambos son candados de CONDUCTA (mueren si el trigger/barrido se rompe), no de palabras.
 * Corren post-migración (ventana/CI), como el resto de los candados S-D.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";

// Mismo SQL que el barrido de `reset-piloto.ts`: borra el contenido SIN dueño vivo.
const SWEEP = `
    DELETE FROM "ContenidoReporte" c
     WHERE NOT EXISTS (SELECT 1 FROM "Reporte" r          WHERE r."contenidoId" = c.id)
       AND NOT EXISTS (SELECT 1 FROM "EventoExpediente" e WHERE e."contenidoId" = c.id)
`;

async function crearReporteVivo(identificador: string) {
    // Plataforma es tabla de SEED (no se trunca en resetDatabase, está en PRESERVADOS.tablas):
    // reusamos una ya sembrada por asegurarPlataformas en vez de crear una con clave fija (que
    // choca al re-correr). El aislamiento lo da que Reporte/Contenido SÍ se truncan por test.
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    return prisma.$transaction((tx) =>
        crearReporteConTexto(tx, {
            texto: "relato de un caso vivo",
            reporte: {
                identificador,
                plataformaId: plataforma.id,
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
            },
        })
    );
}

describe("S-D · integridad de ContenidoReporte (cripto-shred del borrón + XOR de dueño)", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.REPORTE_TEXTO_KEY_V1 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("RISK 1 · el barrido DESTRUYE el contenido huérfano y su DEK (cripto-shred)", async () => {
        // Un contenido sin dueño (lo que dejaría un TRUNCATE que saltea los triggers, o un
        // camino de borrado no cubierto). Debe desaparecer, y su llave con él.
        const { contenidoId } = await sellarTextoNuevo(prisma, { texto: "denuncia a destruir" });
        expect(await prisma.contenidoReporte.count({ where: { id: contenidoId } })).toBe(1);
        expect(await prisma.llaveReporte.count({ where: { contenidoId } })).toBe(1);

        await prisma.$executeRawUnsafe(SWEEP);

        expect(await prisma.contenidoReporte.count({ where: { id: contenidoId } })).toBe(0);
        // La DEK cayó por Cascade → el texto es irrecuperable. Esto es el borrado real.
        expect(await prisma.llaveReporte.count({ where: { contenidoId } })).toBe(0);
    });

    it("RISK 1 · el barrido NO toca el contenido de un caso VIVO (evidencia preservada)", async () => {
        const reporte = await crearReporteVivo("VIVO-1");
        await prisma.$executeRawUnsafe(SWEEP);
        // Su reporte lo referencia → no es huérfano → sobrevive.
        expect(await prisma.contenidoReporte.count({ where: { id: reporte.contenidoId } })).toBe(1);
        expect(await prisma.llaveReporte.count({ where: { contenidoId: reporte.contenidoId } })).toBe(1);
    });

    it("RISK 2 · XOR de dueño: un EventoExpediente NO puede tomar el contenido de un Reporte", async () => {
        const reporte = await crearReporteVivo("XOR-1");
        // Intentar colgar un EventoExpediente del MISMO contenido. El trigger BEFORE INSERT
        // `evento_un_solo_dueno` dispara ANTES de los checks de NOT NULL/FK, así que basta un
        // insert mínimo: si el trigger existe, RAISE 'XOR de dueño'; si se rompió, el error
        // sería otro y este candado (que exige ese texto) cae.
        await expect(
            prisma.$executeRawUnsafe(
                "INSERT INTO \"EventoExpediente\" (\"id\",\"expedienteId\",\"ordenSecuencial\",\"fechaEvento\",\"contenidoId\") VALUES ('xor-evt-1','exp-inexistente',1, now(), $1)",
                reporte.contenidoId
            )
        ).rejects.toThrow(/XOR de dueño/i);

        // El contenido sigue perteneciendo SOLO a su reporte.
        expect(await prisma.reporte.count({ where: { contenidoId: reporte.contenidoId } })).toBe(1);
        expect(await prisma.eventoExpediente.count({ where: { contenidoId: reporte.contenidoId } })).toBe(0);
    });
});
